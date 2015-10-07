/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global module, console */

'use strict';

var dxLog = require('dxLog');

/*
 * Utility routines used commonly across dxData
 */

/*
 * Shortcut for checking if a value is either null or undefined
 */
function isNone(value) {
    return value === null || value === undefined;
}

/*
 * Returns a new object that is a deep clone of the input object.
 */
function deepClone(obj) {
    var result = obj;
    
    if (obj instanceof Array) {
        result = [];
        for (var index = 0; index < obj.length; index++) {
            result[index] = deepClone(obj[index]);
        };
    } else if (obj instanceof Object) {
        if (obj instanceof Date) {
            result = new Date(obj.getTime());
        } else {
            result = {};
            for (var key in obj) {
                result[key] = deepClone(obj[key]);
            };
        }
    }
    
    return result;
}

/*
 * Wrapper function for jquery $.ajax function
 *    config - $.ajax configuration object.
 */
function ajaxCall(config) {
    if (config && config.url) {
        config.type = config.type || 'GET';
        config.contentType = config.contentType || 'application/json';
        config.dataType = config.dataType || 'json';
        
        config.xhrFields = config.xhrFields || {
            withCredentials: true
        };
        
        config.success = config.success || function(d) {
            dxLog.debug(d);
        };
        
        config.error = config.error || function(e) {
            dxLog.debug(e);
        };
        
        config.cache = config.cache || false;
        
        try {
            $.ajax(config);
        } catch (e) {
            dxLog.fail(e.message);
        }
    } else {
        dxLog.fail('Invalid configuration for jQuery ajax call. Unable to complete the operation.');
    }
}

module.exports = {
    isNone: isNone,
    deepClone: deepClone,
    ajaxCall: ajaxCall
};
