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
    /*
     * We support the ability to replace what function is actually performing the
     * necessary ajax calls.  This is only useful, in practice, for the mock servers
     * so they can intercept outgoing calls and respond to them. We allow for multiple
     * mock servers to be installed simultaneously, however only one can respond to
     * a particular request, and the most recent server that took over the calls
     * wins. in this regard, handlers act like a stack. However, any server can
     * remove itself from the stack at any time, even if it isn't the topmost.
     */
    _handlers: [{
        owner: 'dx.baseHandler',
        handler: function (config) {
            return $.ajax(config);
        }
    }],
    hasAjaxHandler: function (owner) {
        var topIndex = this._handlers.length - 1;

        for (let index = topIndex; index > 0; index --) {
            var item = this._handlers[index];

            if (item.owner === owner) {
                return true;
            }
        }

        return false;
    },
    registerAjaxHandler: function(owner, handler) {
        this._handlers.push({
            owner: owner,
            handler: handler
        });
    },
    removeAjaxHandler: function(owner) {
        var topIndex = this._handlers.length - 1;

        for (let index = topIndex; index > 0; index --) {
            var item = this._handlers[index];

            if (item.owner === owner) {
                this._handlers.splice(index , 1);
                return;
            }
        }

        throw new Error('That handler has not been registered.')
    },
    resetAjaxHandlers: function () {
        this._handlers = [{
            owner: 'dx.baseHandler',
            handler: function (config) {
                return $.ajax(config);
            }
        }];
    },
    // This is the main entrypoint to making ajax calls.  It will use
    // the topmost handler to actually do the call.
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
                var topIndex = this._handlers.length - 1;
                var handlerData = this._handlers[topIndex];
                handlerData.handler(config);
            } catch (e) {
                dx.fail(e.message);
            }
        } else {
            dx.fail('Invalid configuration for jQuery ajax call. Unable to complete the operation.');
        }
    }
};

Backbone.ajax = function() {
    return dx.core.ajax.ajaxCall.apply(dx.core.ajax, arguments);
}

})();