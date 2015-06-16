'use strict';

var wmicExec = require('../index.js');

var query = 'Path Win32_NetworkAdapterConfiguration Where (IPEnabled = "true") Get';
wmicExec(query, function(err, results){
    var MACAddressArr = [];

    results.forEach(function(adapterInfo){
        if (!adapterInfo.DefaultIPGateway)
            return;

        MACAddressArr.push(adapterInfo.MACAddress);
    });

    console.log('MACAdress:', MACAddressArr);
});