'use strict';

var os       = require('os'),
    fs       = require('fs'),
    spawn    = require('child_process').spawn,
    debug    = require('debug')('wmic'),
    stripBom = require('strip-bom'),
    concat   = require('concat-stream'),
    replace  = require('replacestream'),
    fecha    = require('fecha'),
    et       = require('elementtree');


var execErr;

function adjustLineEndings(lineEnding){
    lineEnding = lineEnding || os.EOL;
    return replace(/(\r+\n)+/g, lineEnding);
};

function parseOutput(callback){
    var DATETIME_FORMAT = 'YYYYMMDDHHmmss.SSSZZ';

    function adjustTimezone(datetime){
        var delim = '+',
            delimIndex = datetime.indexOf(delim);

        if (delimIndex === -1) {
            delim = '-';
            delimIndex = datetime.indexOf(delim);
        }

        var timeStr = datetime.substr(0, delimIndex),
            tzStr   = datetime.substr(delimIndex + 1);

        while (tzStr.length < 4)
            tzStr = '0' + tzStr;

        return timeStr + delim + tzStr;
    }

    function typedValue(type, val){
        if (val === '')
            val = undefined;

        if (!val)
            return val;

        switch (type) {
            case 'uint8':
            case 'uint16':
            case 'uint32':
                return Number(val);

            case 'datetime':
                val = adjustTimezone(val);
                return fecha.parse(val, DATETIME_FORMAT);

            case 'string':
                return val + '';

            case 'boolean':
                return val === 'TRUE';
            
            default:
                return val;
        }
    }

    function assignPropValue(result, name, type, propertyEl){
        var val      = propertyEl.findtext('./VALUE'),
            typedVal = typedValue(type, val);

        if (typedVal !== undefined)
            result[name] = typedVal;
    }

    function assignPropValuesArray(result, name, type, propertyEl){
        var values = propertyEl.findall('./VALUE.ARRAY/VALUE').map(function(valueEl){
            return valueEl.text || '';
        });

        var typedValues = [];
        values.forEach(function(val){
            var typedVal = typedValue(type, val);
            if (typedVal !== undefined)
                typedValues.push(typedVal);
        });

        if (typedValues.length > 0)
            result[name] = typedValues;
    }

    function resultsMapper(instanceEl){
        var result = { __class__: instanceEl.attrib.CLASSNAME };

        instanceEl.getchildren().forEach(function(propertyEl){
            var name = propertyEl.attrib.NAME,
                type = propertyEl.attrib.TYPE;

            if (propertyEl.tag === 'PROPERTY')
                assignPropValue(result, name, type, propertyEl);

            else if (propertyEl.tag === 'PROPERTY.ARRAY')
                assignPropValuesArray(result, name, type, propertyEl);
        });

        return result;
    }

    return concat(function(buffer){
        if (execErr) {
            callback(execErr);
            return;
        }

        var result = stripBom(buffer);
        debug('stdout:', result);

        var doc     = et.parse(result),
            results = doc.findall('RESULTS/CIM/INSTANCE').map(resultsMapper);
       
        callback(null, results);
    });
}

function wmicExec(query, options, callback){
    if (arguments.length == 2) {
        callback = options;
        options = {};
    }

    if (!query || !query.length) {
        callback(new Error('Param query is blank!'));
        return;
    }

    callback = callback || Function.prototype;
    function cbWrapper(){
        fs.unlinkSync('./TempWmicBatchFile.bat');
        callback.apply(this, arguments);
    }

    var q    = query.trim().replace(/"/g, "'"),
        args = q.split(' ');

    args.push('/format:rawxml');

    debug('original query:', query);
    debug('processed query:', args.join(' '));

    var wmic = spawn('wmic', args, { stdio: [ 'ignore' ]});

    wmic.stdout
        .pipe(adjustLineEndings())
        .pipe(parseOutput(cbWrapper));

    wmic.stderr
        .pipe(concat(function(buffer){
            var errMsg = buffer.toString()
                .trim().replace(/(\r+\n)+/g, '\n')
                .replace(/\n*ERROR:/i, '');

            if (!errMsg)
                return;

            debug('stderr:', errMsg);
            execErr = new Error(errMsg);
        }));
}

module.exports = wmicExec;