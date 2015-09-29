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
 * Copyright (c) 2014 by Delphix. All rights reserved.
 */

/*global dx */

"use strict";

var dxData = require('../src/modules/dxData.js');
/*
 * Some wrappers around browser access
 */
dx.namespace('dx.core.browser');

dx.core.browser.getWindowLocation = function() {
    return {
        origin: '',
        hash: ''
    };
};

/*
 * Start the mock server. This is loaded as part of the unit test system so that the mock server is available to tests.
 */
var temp = new dxData.DataSystem(delphixSchema);
_.extend(dx.core.data, temp);
