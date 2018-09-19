const Node = require('./pow_node.js');
const peerList = require('./peer.json');
const STRATEGY = {
    ASCENT : 0,
    DESCENT : 1,
    RANDOM : 2
}
let node1 = new Node(STRATEGY[process.argv[2]], process.argv[3], process.argv[4], peerList);
node1.init();
//node1.miningStart();
