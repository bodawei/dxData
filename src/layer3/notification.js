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

/*global dx, _ */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');

/*
 * This notification system receives updates from the server about objects that have been created, deleted or updated.
 * This system, in turn, converts those notifications into calls to the underlying cache system so all models and
 * collections being used are up to date with whatever information is in the server.  Without the notification system
 * turned on, the models and collections are not assured of being up to date with what the server knows about.
 *
 * To use the notification system, simply call the start() function at the start of your program. To stop receiving
 * notifications, call stop(). You can also call isStarted() to verify whether the notification system is turned on.
 */
function setupNotificationSystem(context, notificationDropped) {

    /*
     * We use long polling to fetch notifications. We want to make sure our timeout is less than the browser timeout,
     * but otherwise the call will return as soon as data is available.
     */
    var TIMEOUT_SEC = 12;

    /*
     * If the call fails, we don't want to spin in a loop retrying. Attempt a new request after this time period.
     */
    var RETRY_SEC = 10;

    var date = new Date();
    var timeout;
    var stopped = true;
    var notification;
    var notificationChannel = date.getTime() + '_html';

    function processNotifications(notifications) {
        var uniqueObjectNotifications = {};
        var uniqueSingletonNotifications = {};

        /*
         * Pre-process notifications. Keep only the last notification for a particular object. Thus, should we receive a
         * create, update and delete notification for an object, we will only keep the delete. This assumes that we
         * never get a non-delete notification after getting a delete notification.
         */
        notifications.each(function(model) {
            switch (model.get('type')) {
                case 'ObjectNotification':
                    var reference = model.get('object');
                    uniqueObjectNotifications[reference] = model;
                    break;
                case 'SingletonUpdate':
                    var type = model.get('objectType');
                    if (!_.has(uniqueSingletonNotifications, type)) {
                        uniqueSingletonNotifications[type] = model;
                    }
                    break;
                case 'NotificationDrop':
                    if (notificationDropped) {
                        notificationDropped(model.get('dropCount'));
                    } else {
                        dxLog.warn('Dropped ' + model.get('dropCount') + " notifications.");
                    }
                    break;
                // we ignore all other types
            }
        });

        /*
         * With the uniquified set of object notifications, loop through them and retrieve or delete our copies of the
         * objects on the server
         */
        _.each(uniqueObjectNotifications, function(notification, objRef) {
            try {
                var type = notification.get('objectType');
                var rootType = context.getCollectionTypeFromModelType(type);

                switch (notification.get('eventType')) {
                    case 'CREATE':
                    case 'UPDATE':
                        var subscriptionUsesModel = context._modelSubscribersStore.hasType(rootType);
                        var hasModel = context._cache.containsCachedModel(objRef, rootType);
                        if (subscriptionUsesModel || hasModel) {
                            var model = context._cache.getCachedModel(objRef, rootType, {
                                update: true,
                                cacheOnlyIfNeeded: true,
                                suppressDefaultErrorHandler: true
                            });
                            model.once('error', function(model, err) {
                                dxLog.warn('Got an error when doing a ' + notification.get('eventType') + ' on ' +
                                    objRef + '.', err.toJSON());
                            });
                        }
                        break;
                    case 'DELETE':
                        context._cache.deleteCachedModel(objRef, rootType);
                        break;
                    default:
                        dxLog.warn('Unknown event type: ' + notification.get('eventType'));
                }
            } catch (e) {
                // We really don't want notification processing to stop, so swallow any exception and keep going
                dxLog.warn('notification processing failed: ' + e.message);
            }
        });

        /*
         * Finally, update all the singletons that have been changed, as well.
         */
        _.each(uniqueSingletonNotifications, function(notification, type) {
            try {
                context._cache.getCachedSingleton(type, {update: true});
            } catch (e) {
                // We really don't want notification processing to stop, so swallow any exception and keep going
                dxLog.warn('notification processing failed: ' + e.message);
            }
        });
    }

    function fetchNotifications() {
        timeout = undefined;

        notification.$$list({
            timeout: '' + TIMEOUT_SEC * 1000,
            channel: notificationChannel
        }, {
            success: function() {
                // We want to make sure notifications don't ever stall, even if there is some unknown problem
                if (!stopped) {
                    try {
                        processNotifications(notification);
                    } finally {
                        fetchNotifications();
                    }
                }
            },
            error: function() {
                if (!stopped) {
                    dxLog.warn('Notification call failed.');
                }

                if (stopped) {
                    return;
                }

                timeout = setTimeout(fetchNotifications, RETRY_SEC * 1000);
            }
        });
    }

    /*
     * For testing purposes. This returns the timeout used for retries for predictable results.
     */
    function _getRetryTimeout() {
        return RETRY_SEC * 1000;
    }

    function start() {
        if (_.isUndefined(notification)) {
            notification = context.getServerCollection('Notification');
        } else {
            dxLog.fail('Notification system already started.');
        }
        stopped = false;
        fetchNotifications();
    }

    function isStarted() {
        return !stopped;
    }

    function stop() {
        if (notification) {
            notification = undefined;
        }
        if (timeout) {
            clearTimeout(timeout);
        }
        stopped = true;
    }

    context = context || dx.core.data;
    context.notification = context.notification || {};
    _.extend(context.notification, {
        _getRetryTimeout: _getRetryTimeout,
        start: start,
        isStarted: isStarted,
        stop: stop
    });
};

module.exports = setupNotificationSystem;
