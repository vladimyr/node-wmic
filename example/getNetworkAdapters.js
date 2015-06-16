'use strict';

var wmicExec = require('../index.js');

var query = "Path Win32_NetworkAdapterConfiguration Where (IPEnabled = 'true') Get";
wmicExec(query, function(err, results){
    console.log(JSON.stringify(results, null, 2));
});