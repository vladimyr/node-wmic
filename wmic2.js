#!/usr/bin/env node

'use strict';

var argv     = require('minimist')(process.argv.slice(2)),
    chalk    = require('chalk'),
    wmicExec = require('./index.js');

var query       = argv._[0],
    verbose     = argv.v || argv.verbose,
    prettyPrint = argv.p || argv.pretty;

wmicExec(query, { verbose: verbose }, function(err, results){
    if (err) {
        console.error(chalk.red('Error:', err.message));
        return;
    }

    var indent;
    if (prettyPrint)
        indent = 2;

    var jsonStr = JSON.stringify(results, null, indent);
    console.log(jsonStr);
});