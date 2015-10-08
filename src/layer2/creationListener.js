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
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global module, require */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');

var FilterUtil = require('./FilterUtil.js');
var CONSTANT = require('../util/constant.js');
var util = require('../util/util.js');

var filterUtil = new FilterUtil();

/*
 * Creation listeners provide access to notification updates for API server objects creation in the form
 * of level2 models.
 *
 *   typeName         The schema type for which one receives notifications.
 *
 *   callback         A function to be invoked with a level2 model as argument for each create notification.
 *
 *   queryParams      Optional query parameters used to filter notifications.
 *
 *   context          The context to access other dxData content (cache, filters).
 */
function CreationListener(settings) {
    var self = this;
    if (util.isNone(settings.typeName)) {
        dxLog.fail('To create a new creation listener, a type name must be provided.');
    }
    var typeName = settings.typeName;
    var context = settings.context;
    if (!isListableType(typeName, context)) {
        dxLog.fail(typeName + ' is not a known type with a list operation. Can not create this creation listener.');
    }
    if (!_.isFunction(settings.callback)) {
        dxLog.fail('Callback must be provided as a function.');
    }

    self._dxInfo = {
        baseType: settings.typeName
    };

    self.inUse = true;

    self.getQueryParameters = function() {
        return settings.queryParams;
    };

    // The format must remain compatible with level2-collections and level2-cache.
    self._dxAddOrRemove = function(model) {
        if (!self.inUse) {
            return;
        }
        
        if (!settings.filters || !settings.filters[typeName]) {
            settings.callback(model);
            return;
        }

        settings.filters[typeName](self, model, function(placement) {
            switch (placement) {
                case CONSTANT.FILTER_RESULT.INCLUDE:
                    settings.callback(model);
                    break;
                case CONSTANT.FILTER_RESULT.EXCLUDE:
                    break;
                case CONSTANT.FILTER_RESULT.UNKNOWN:
                    dxLog.fail('UNKNOWN filter result not supported by creation listeners');
                    break;  // to keep ant check happy.
                default:
                    dxLog.fail('Filter returned an invalid value.');
            }
        }, filterUtil);
    };

    self.dispose = function() {
        self.inUse = false;
    };
}

function isListableType(typeName, context) {
    return !!context._collectionConstructors[typeName];
}

module.exports = CreationListener;
