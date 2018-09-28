const PoWUtil = require('./powUtil');
const Miner = require('./Miner');
const BlockManager = require('./BlockManager');
const fs = require('fs');

class Node{
    constructor(_miningStrategy, _difficulty, _url, _peerList){
        this.miningStrategy = _miningStrategy
        this.difficulty     = _difficulty;
        this.blockManager   = new BlockManager(this, _url, _peerList);
        this.miner          = new Miner(_miningStrategy);
        this.init           = this.init.bind(this);
        this.startMining    = this.startMining.bind(this);
    }
    init(){
        setInterval(x=>{
            let report = "blockData INFO\n"+JSON.stringify(this.blockManager.blockData, null, 2);
            fs.writeFile('log_'+this.blockManager.url, report, x=>x);
        }, 30000);

        this.blockManager.init();
        this.startMining();
    }
    startMining(_time=0){
        setTimeout(()=>{
            this.miner.miningBlock(this.blockManager.getLastBlock(), PoWUtil.getRandomData(), this.difficulty)
            .then(block => {
                let time = this.blockManager.addBlock(block);
                this.startMining(time);
            })
            .catch(e =>{
                console.error(e);
            })
        }, _time);
    }
}

module.exports = Node;