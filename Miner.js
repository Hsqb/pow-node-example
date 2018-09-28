const PoWUtil = require("./powUtil");
const Block  = require('./Block');
const threads = require('threads');
const tConfig = threads.config;
const spawn = threads.spawn;
tConfig.set({ basepath : {
    node : __dirname
}})


class Miner{
    constructor(_miningStrategy=0){
        this.miningStrategy = _miningStrategy;
        this.miningBlock = this.miningBlock.bind(this);
    }
    miningBlock(prevBlock, _data, _difficulty){
        let prevHashVal = PoWUtil.getHashFromBlock(prevBlock);
        if(prevHashVal === null){
            console.error("Prev block : "+JSON.stringify(prevBlock))
            throw new Error("Wrong Block in Blockchain.");
        } 
        //싱글스레드 문제를 피하기 위해 별도의 스레드를 올려서 해시값을 계산한다.
        let hashThread = spawn('worker.js');
        return new Promise((resolve, reject)=>{
            console.log("Mining Start Block Number : "+(prevBlock.header.blockNumber + 1));
            hashThread 
            .send({ 
                    miningStrategy : this.miningStrategy,
                    prevHashVal : prevHashVal,
                    data : _data,
                    timestamp : PoWUtil.getTimestamp(),
                    nonce : 0,
                    difficulty : _difficulty })
            .on('message',function(res){  
                hashThread.kill();
                resolve(new Block(prevBlock.header.blockNumber + 1,
                    prevHashVal,
                    res.nonce,
                    res.timestamp,
                    res.difficulty, 
                    res.data));
            })
            .on('error', function(e){
                console.error("Some Error during Mining Thread");
                throw new Error(e);
            })
        })

    }
    
}

module.exports = Miner;