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

'use strict'

/*global dx, $ */

var buzzrData = {};

(function() {

var hasSession = false;
var docReady = false;

// Start up the data system
dx.core.data.setupDataSystem(ALL_SCHEMAS, undefined, buzzrData);

var session = buzzrData.getServerSingleton("Session");
session.once('ready', function() {
    hasSession = true;
    buzzrData.notification.start();
    startup();
});

$('document').ready(function() {
    docReady = true;
    startup();
});

function startup() {
    if (!hasSession || !docReady) {
        return;
    }
    var currentUser = new CurrentUserView();
    var inputView = new BuzzInputView();
    var listView = new BuzzListView();
    $('.sid-buzzr-user-box').append(currentUser.$el);
    $('.sid-buzzr-input-box').append(inputView.$el);
    $('.sid-buzzr-list-box').append(listView.$el);
}

})();