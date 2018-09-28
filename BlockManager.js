const topology = require('fully-connected-topology');
const PoWUtil = require('./PoWUtil');
const Block = require('./Block');

const BLOCK_PACK_NUM = 5;
const MINING_TIMEOUT_1SEC = 100;
const MINING_TIMEOUT_0SEC = 0;

class BlockManager{
    constructor(_node, _url, _peerList){
        console.log("MyUrl : "+_url);
        this.url            = _url;
        this.node           = _node;
        this.isSync         = true;
        this.blockData      = [];
        this.bestPeer       = {peer:"", length:0};
        this.currentConnectedPeer = {};
        this.tp                     = topology(_url, _peerList);

        this.init                   = this.init.bind(this);
        this.getLastBlock           = this.getLastBlock.bind(this);
        this.setUpNewPeerConnection = this.setUpNewPeerConnection.bind(this);
        
        this.reqNodeInfo            = this.reqNodeInfo.bind(this);
        this.resReqNodeInfo         = this.resReqNodeInfo.bind(this);
        this.processNodeInfo        = this.processNodeInfo.bind(this);

        this.reqBlocks              = this.reqBlocks.bind(this);
        this.resReqBlocks           = this.resReqBlocks.bind(this);
        this.processBlocks          = this.processBlocks.bind(this);
  
        this.receiveData            = this.receiveData.bind(this);
        this.validateBlocks         = this.validateBlocks.bind(this);
        this.addBlock               = this.addBlock.bind(this);
        this.receiveBlock            = this.receiveBlock.bind(this);


    }
    init(){
        if(this.blockData.length === 0){
            this.blockData.push(new Block());
        }
        this.tp.on('connection',(socket, peer)=>{this.setUpNewPeerConnection(socket,peer)});
    }

    getLastBlock(){
        return this.blockData[this.blockData.length - 1];
    }
    setUpNewPeerConnection(socket, peer){
        console.log("A Peer is Connected : "+peer);
        this.isSync = false;
        this.currentConnectedPeer[peer] = true;
        socket.on('data', rawData => this.receiveData(socket, rawData));
        //일단 상대에게 누가 더 체인이긴지 한 명이 확인해본다.
        this.reqNodeInfo(socket);
    }

    reqNodeInfo(socket){
        PoWUtil.writeOnSocket(socket, { message:"reqNodeInfo" });
    }
    resReqNodeInfo(socket, dataObj){
        PoWUtil.writeOnSocket(socket, { message:"resReqNodeInfo", 
                                        blockLength : this.blockData.length,
                                        lastBlockHash : PoWUtil.getHashFromBlock(this.getLastBlock())
                                    });
    }
    processNodeInfo(socket, dataObj){
        if(this.blockData.length > dataObj.blockLength){
            //자신이 더 긴 블록을 가지고 있다면 싱크가 되어 있다고 판단함
            this.isSync = true;
        }else if(this.blockData.length < dataObj.blockLength){
            //자신의 블록길이가 더 작은 경우 상대에게 블록을 요구함
            this.isSync = false;
            this.syncBlockChain(socket);
        }else{
            //같은경우 
            //마지막 블록 해시가 같으면 싱크된 것으로 판단
            if(dataObj.lastBlockHash === PoWUtil.getHashFromBlock(this.getLastBlock())){
                this.isSync =  true;
            }else{
                //마지막 블록 해시가 다르면 싱크시도를 해야함.
                this.isSync = false;
                this.syncBlockChain(socket);
            }
            
        }
    }

    reqBlocks(socket, _index){
        //index부터 BLOCK_PACK_NUM 개수만큼 요청
        PoWUtil.writeOnSocket(socket, { message:"reqBlocks", index : _index });
    }
    resReqBlocks(socket, _index){
        //index부터 BLOCK_PACK_NUM 개수만큼 전송
        PoWUtil.writeOnSocket(socket, { message:"resReqBlocks", 
                              index : _index, 
                              blocks : this.blockData.slice(_index, _index + BLOCK_PACK_NUM) });
    }
    processBlocks(socket, _index, _blocks){
        if(this.validateBlocks(_blocks)){
            for(let i = 0,  j = _index ; i < _blocks.length ; i++, j++){
                //blockData[j]가 없으면 블록체인에 입력을 시도한다.
                if(!this.blockData[j]){
                    this.receiveBlock(_blocks[i]);
                }else if(PoWUtil.getHashFromBlock(this.blockData[j]) !== PoWUtil.getHashFromBlock(_blocks[i])){
                    if( i === 0 ){
                        //첫 블록부터 일치하지 않는 다면 분기점이 index이전. 
                        //BLOCK_PACK_NUM이전으로 탐색을 계속한다.
                        this.syncBlockChain(socket, _index - BLOCK_PACK_NUM );
                    }else{
                        //중간 블록부터 일치하지 않는 다면 분기점이 j - 1 이므로 j - 1로 재요청
                        //BLOCK_PACK_NUM이전으로 탐색을 계속한다.
                        this.syncBlockChain(socket, j - 1 );
                    }
                    return;
                }
            }
        }
        //BLOCK_PACK_NUM갯수만큼 블록이 도착한다면 이후 블록이 있을 가능성이 높으므로 다시요청.
        if(_blocks.length === BLOCK_PACK_NUM){
            this.reqBlocks(socket, this.blockData.length - 1);
        }else if(_blocks.length < BLOCK_PACK_NUM){
            //아니라면 싱크가 완료되었으므로 싱크 종료.
            this.isSync = true;
        }
    }
    syncBlockChain(socket, _index = (this.blockData.length - 1) ){
        let newIndex = _index < 0 ? 1 : _index;
        this.reqBlocks(socket, newIndex);
    }
    validateBlocks(blocks){
        return blocks.reduce((acc, val, index, arr) => {
            if(index === 0){
                acc = acc && PoWUtil.isValidHash(PoWUtil.getHashFromBlock(val), val.header.difficulty);
            }else{
                acc = acc && PoWUtil.isValidChain(arr[index - 1], arr[index])                
            }
            return acc;
        }, true);
    }
    addBlock(newBlock){
        //return Number() => 다음 채굴 작업에 들어갈 시간을 반환
        if(this.isSync && PoWUtil.isValidChain(this.getLastBlock(), newBlock)){
            this.blockData.push(newBlock);
            this.broadcastBlock(newBlock);
            return MINING_TIMEOUT_0SEC;
        }
        return MINING_TIMEOUT_1SEC;
    }
    receiveBlock(newBlock){
        console.log("Receive Block! "+newBlock.header.blockNumber)
        //valildate and push
        if(PoWUtil.isValidChain(this.getLastBlock(), newBlock)){
            this.blockData.push(newBlock);
        }else{
            console.log("Unvalid valid block "+newBlock.header.blockNumber);
        }
    }
    broadcastBlock(newBlock){
        Object.keys(this.currentConnectedPeer).map(addr=>{
            let socket = this.tp.peer(addr);
            if(socket != null){
             PoWUtil.writeOnSocket(socket, {
                message : "broadcastBlock",
                block : newBlock});
             }
        });
    }
    receiveData(socket, rawData){
        let rawStr = rawData.toString();
        if(rawStr.split(" ").length > 2){
            rawStr = rawStr.split(" ")[1];
        }
        let dataObj = JSON.parse(rawStr);
        switch(dataObj.message){
            case "reqNodeInfo" : 
                this.resReqNodeInfo(socket, dataObj);
                break;
            case "resReqNodeInfo" :
                this.processNodeInfo(socket, dataObj);
                break;
            case "reqBlocks" : 
                this.resReqBlocks(socket, dataObj.index);
                break;
            case "resReqBlocks" : 
                this.processBlocks(socket, dataObj.index, dataObj.blocks);
                break;
            case "broadcastBlock" :
                if(this.isSync){
                    this.receiveBlock(dataObj.block);
                }else{
                    this.syncBlockChain(socket);
                }
                break;
            default :
                throw new Error("Undefined Message : "+dataObj.message);
                break;
                
        }
    }
    
}
module.exports = BlockManager;