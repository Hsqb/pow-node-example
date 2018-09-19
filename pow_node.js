const topology = require('fully-connected-topology');
const PoWUtil = require('./powUtil');
const Block = require('./Block');
const fs = require('fs');

const threads = require('threads')
const tConfig = threads.config;
const spawn = threads.spawn;
tConfig.set({ basepath : {
    node : __dirname
}})

function PoWNode(miningStrategy, difficulty, url, peerList){
    this.currentConnectedPeer = {};
    this.isSync = false;
    this.bestPeer = {peer:"", length:0};
    console.log("MyUrl : "+url);
    this.tp = topology(url, peerList);
    this.tp.on('connection', (socket, peer)=>{
        console.log("Peer Connection : "+peer);
        this.currentConnectedPeer[peer] = true;
        //일단 상대에게 누가 더 체인이긴지 한 명이 확인해본다.
        if( url > peer){
            this.isSync = true;
            socket.write(JSON.stringify({message : "whoisthebest", length: this.blockData.length})+" ");    
        }

        socket.on('data', rawdata =>{
            rawStr = rawdata.toString();
            if(rawStr.split(" ").length > 2){
                rawStr = rawStr.split(" ")[1];
            }
            let dataObj = JSON.parse(rawStr);
            //상대에게 누가 더 긴지 확인요청이 오면 자신과 비교하여 알려준다.
            if(dataObj.message == "whoisthebest"){
                this.isSync = true;
                if(this.blockData.length > dataObj.length){
                    socket.write(JSON.stringify({message:"imbetter", length:this.blockData.length})+" ");
                }else if(this.blockData.length < dataObj.length){
                    //내가 더 짧다면 달라고 한다.
                    socket.write(JSON.stringify({message:"givemeyours"}));
                }else{
                    socket.write(JSON.stringify({message:"same", lastBlock : this.blockData[this.blockData.length - 1]})+" ");
                    //블록수가 같으면 마지막 블록을 던져서 값을 확인해볼수 있도록 한다.
                }
            }
            if(dataObj.message == "imbetter"){
                if(this.bestPeer.length < dataObj.length){
                    this.bestPeer.peer = peer;
                    this.bestPeer.length = dataObj.length;
                }
                socket.write(JSON.stringify({message:"givemeyours"}));
            }
            if(dataObj.message == "yourebetter"){
                //별로 할일이 없음
            }
            if(dataObj.message == "same"){
                if(this.blockData[this.blockData.length - 1].header.blockNumber == dataObj.lastBlock.header.blockNumber &&
                    this.blockData[this.blockData.length - 1].header.nonce == dataObj.lastBlock.header.nonce &&
                    this.blockData[this.blockData.length - 1].header.prevHash == dataObj.lastBlock.header.prevHash &&
                    this.blockData[this.blockData.length - 1].header.difficulty == dataObj.lastBlock.header.difficulty
                    ){
                        //싱크종료
                        console.log("Chian is same. Sync is finished.");
                        this.isSync = false;
                    }else{
                        console.log("Wrong Chain");
                    }
            }
            if(dataObj.message == "givemeyours"){
                socket.write(JSON.stringify({message:"thisissyncblocks", blocks:this.blockData}));
                this.isSync = false;
            }
            if(dataObj.message == "thisissyncblocks"){
                let blocks = dataObj.blocks;
                for(let i = 0 ; i < this.blockData.length; i++){
                    if(blocks[i].header.prevHash != this.blockData[i].header.prevHash){
                        console.error("It's a junction : "+i);
                        this.blockData = this.blockData.slice(0,i).concat(blocks.slice(i));
                        this.isSync = false;
                        return;
                    }
                }
                this.blockData = this.blockData.slice(0,this.blockData.length).concat(blocks.slice(this.blockData.length));
                this.isSync = false;
                console.log("Synched BlockData Len : "+this.blockData.length);
            }
            if(dataObj.message == "thisisanewblock"){
                let block = dataObj.block
                let data = block.header.prevHash + JSON.stringify(block.body.data) +
                            block.header.timestamp +block.header.nonce;
                let hash = PoWUtil.getHashHex(data);

                if(PoWUtil.isValidHash(hash, block.header.difficulty)){
                    let lastBlock = this.blockData[this.blockData.length - 1];
                    if((lastBlock.header.blockNumber + 1) == block.header.blockNumber &&
                        PoWUtil.getHashFromBlock(lastBlock) == block.header.prevHash){
                        this.blockData.push(block);
                        console.log("Block "+block.header.blockNumber+" INS by "+peer+" len "+this.blockData.length);
                        this.miningStart();
                    }else{
                        console.log("Dup block arrived. "+block.header.blockNumber);
                    }
                }else{
                    console.log(peer +" is doubtble node.");
                    tp.remove(peer);
                }
            }
        });
    })

    this.blockData = [];
    this.difficulty = difficulty;
    this.miner = new Miner(miningStrategy);
    this.init = function(){
        if(this.blockData.length == 0){
            this.blockData.push(new Block());
        }
        this.miningStart();
        setInterval(x=>{
            let report = "blockData INFO\n"+JSON.stringify(this.blockData, null, 2);
            fs.writeFile('log_'+url, report, x=>x);
        }, 30000);
        //30초에 한번씩 블록체인을 출력한다.
    }

    this.getNewBlock = function(){
        this.miner.setUpBlock(this.blockData[this.blockData.length - 1],
            PoWUtil.getRandomData(),
            this.difficulty);
        this.miner.start().then(newBlock =>{
            if(newBlock != null){
                if(this.isSync){
                    this.miningStart(1000);
                }else{
                    let lastBlock = this.blockData[this.blockData.length - 1];
                    if((lastBlock.header.blockNumber + 1) == newBlock.header.blockNumber &&
                        PoWUtil.getHashFromBlock(lastBlock) == newBlock.header.prevHash){
                        console.log("Block "+newBlock.header.blockNumber+" CRT by "+url+" len "+this.blockData.length);//+JSON.stringify(newBlock)
                        this.blockData.push(newBlock);
                        Object.keys(this.currentConnectedPeer).map(addr=>{
                            let socket = this.tp.peer(addr);
                            if(socket != null) socket.write(JSON.stringify({
                                message : "thisisanewblock",
                                block : newBlock})+" ");
                        })
                        this.miningStart();

                    }else{
                        //Block is made but it's orpant block
                        this.miningStart(60000);
                    }
                }

                
            }
        })
    }
    this.miningStart = function(time=0){
        setTimeout(this.getNewBlock.bind(this),time);
    }
}

function Miner(miningStrategy=0){
    this.isMining = false;
    this.miningStrategy = miningStrategy;
    this.prevBlock = {};
    this.newBlockSources = {};
    this.setUpBlock = function(_prevBlock, _data, _difficulty){
        this.prevBlock = _prevBlock;
        this.newBlockSources = {
            data : _data,
            timestamp : parseInt(Date.now()/1000),
            nonce : 0,
            difficulty : _difficulty
        }
    }
    
    this.miningBlock = function(){
        let prevBlock = this.prevBlock;
        let prevHashVal = PoWUtil.getHashFromBlock(this.prevBlock);
        if(prevHashVal == null){
            console.error("Prev block : "+JSON.stringify(this.prevBlock))
            throw new Error("Wrong Block in Blockchain.");
        } 
        //싱글스레드 문제를 피하기 위해 별도의 스레드를 올려서 해시값을 계산한다.
        let hashThread = spawn('worker.js');
        return new Promise((resolve, reject)=>{
            hashThread 
            .send({prevHashVal : prevHashVal, 
                   newBlockSources : this.newBlockSources})
            .on('message',function(res){  
                hashThread.kill();    
                resolve(new Block(prevBlock.header.blockNumber + 1,
                    prevHashVal, 
                    res.newBlockSources.nonce, 
                    res.newBlockSources.timestamp,
                    res.newBlockSources.difficulty, 
                    res.newBlockSources.data));
            })
            .on('error', function(e){
                console.error("Some Error during Mining Thread");
                console.error(e);
                reject(e);
            })
        })

    }
    
    this.start = function(){
        return this.miningBlock();
    }
}

module.exports = PoWNode;