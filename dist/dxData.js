(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
 * Copyright (c) 2013, 2014 by Delphix. All rights reserved.
 */

/*global _, dx */

'use strict';

/*
 * Misc "common code" needed by the dxData code
 */
(function() {

/*
 * Delphix framework/top-level namespace
 */
window.dx = window.dx || {
    namespace: function(namespace) {
        var current = window;
        _.each(namespace.split('.'), function(pName) {
            current = (current[pName] = current[pName] || {});
        });
        return current;
    },
 
    /*
     * Report a failing message. Writes the info to the console and throws an error
     */
    fail: function() {
        window.console.error.call(window.console, arguments);
        throw new Error(arguments[0]);
    },
 
    /*
     * Report a warning message. Writes the info to the console
     */
    warn: function() {
        window.console.warn.call(window.console, arguments);
    },

    /*
     * Report an info message. Writes the info to the console
     */
    info: function() {
        window.console.info.call(window.console, arguments);
    },

    /*
     * Report an debug message. Writes the info to the console
     */
    debug: function() {
        window.console.info.call(window.console, arguments);
    },

    /*
     * Dummy stub for a localization system
     */
    gls: function(message) {
        return '[' + message + ']';
    }
};

/*
 * Constants
 */
dx.namespace('dx.core.constants');

dx.core.constants = {
    INEQUALITY_TYPES: {
        STRICT: 'STRICT',
        NON_STRICT: 'NON-STRICT'
    },
    LIST_TYPES: {
        NONE:   'NONE',
        UBER:   'UBER',
        CUSTOM: 'CUSTOM'
    }
};

/*
 * General utilities
 */
dx.namespace('dx.core.util');

dx.core.util = {
    /*
     * Short cut for checking if a value is either null or undefined
     */
    isNone: function(value) {
        return _.isNull(value) || _.isUndefined(value);
    },
 
    /*
     * Stub for reloading the client in the case we've been told by the server we are out of sync
     */
    reloadClient: function() {
    },

    /*
     * Returns a new object that is a deep clone of the input object.
     */
    deepClone: function(obj) {
        var result = obj;

        if (_.isArray(obj)) {
            result = [];
            _.each(obj, function(value, index) {
                result[index] = dx.core.util.deepClone(value);
            });
        } else if (_.isObject(obj)) {
            if (obj instanceof Date) {
                result = new Date(obj.getTime());
            } else {
                result = {};
                _.each(obj, function(value, index) {
                    result[index] = dx.core.util.deepClone(value);
                });
            }
        }

        return result;
    }

};

/*
 * Ajax utility routines
 */
dx.namespace('dx.core.ajax');

/*
 * Wrapper function for jquery $.ajax function
 *    config - $.ajax configuration object.
 */
dx.core.ajax = {
    ajaxCall: function(config) {
        if (config && config.url) {
            config.type = config.type || 'GET';
            config.contentType = config.contentType || 'application/json';
            config.dataType = config.dataType || 'json';

            config.xhrFields = config.xhrFields || {
                withCredentials: true
            };

            config.success = config.success || function(d) {
                dx.debug(d);
            };

            config.error = config.error || function(e) {
                dx.debug(e);
            };

            config.cache = config.cache || false;

            try {
                $.ajax(config);
            } catch (e) {
                dx.fail(e.message);
            }
        } else {
            dx.fail('Invalid configuration for jQuery ajax call. Unable to complete the operation.');
        }
    }
};

})();
},{}]},{},[1])
//# sourceMappingURL=dxData.js.map
