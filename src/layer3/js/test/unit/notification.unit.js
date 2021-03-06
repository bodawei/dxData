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

/*eslint-env jasmine */
/*global dx, $, _ */

'use strict';

describe('notification processor', function() {
    var server;
    var client;
    var clock;

    beforeEach(function() {
        clock = jasmine.clock();
        var schemas = _.extend({
            '/group.json': {
                root: '/webapi/somewhere',
                name: 'Group',
                extends: {
                    $ref: '/delphix-persistent-object.json'
                },
                list: {
                    parameters: {
                        age: {
                            type: 'integer',
                            mapsTo: 'age'
                        }
                    }
                },
                read: {},
                update: {},
                properties: {
                    name: {
                        type: 'string'
                    },
                    age: {
                        type: 'integer'
                    }
                }
            }
        }, {
            '/happy-singleton.json': {
                root: '/webapi/happysingleton',
                name: 'HappySingleton',
                singleton: true,
                extends: {
                    $ref: '/delphix-typed-object.json'
                },
                read: {},
                update: {},
                properties: {
                    harmonicaColor: {
                        type: 'string'
                    }
                }
            }
        }, dx.test.CORE_SCHEMAS);
        server = new dx.test.MockServer(schemas);
        server._filters = _.clone(dx.test._filters);
        server._filters.Group = server._filters._uberFilter;
        server.start();

        client = {};
        dx.core.data.setupDataSystem(schemas, client);
        client._filters.Group = client._filters._uberFilter;
    });

    afterEach(function() {
        client.notification.stop();
        server.stop();
        clock.uninstall();
    });

    describe('_setupNotificationSystem()', function() {
        it('establishes the notification system on a specified context', function() {
            var context = {};
            dx.core.data._setupNotificationSystem(context);

            expect(context.notification.start).toBeDefined();
        });
    });

    it('fetches changes in a collection', function() {
        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }],
            Notification: [{
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        }, true);

        // Get the current collection state
        var groups = client.getServerCollection('Group');
        groups.$$list();
        server.respond();
        expect(groups.get('GROUP-1').get('name')).toEqual('a');

        // Update the name of the group, and fetch pending notifications
        client.notification.start();
        var groupChange = jasmine.createSpy('groupChange');
        groups.on('change', groupChange);
        server.updateObjects([{
            reference: 'GROUP-1',
            name: 'b'
        }], true);
        server.respond();
        groups.off();
        client.notification.stop();

        expect(groupChange).toHaveBeenCalled();
        expect(groups.get('GROUP-1').get('name')).toEqual('b');
    });

    it('swallows object missing exceptions for update notification', function() {
        var updateError = jasmine.createSpy('updateError');
        var groupRemove = jasmine.createSpy('groupRemove');

        client.setErrorCallback(updateError);

        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }],
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        }, true);

        var groups = client.getServerCollection('Group');
        groups.$$list();
        groups.on('remove', groupRemove);
        server.respond();

        server.deleteObjects(['GROUP-1'], true);

        client.notification.start();
        server.respond();
        groups.off();
        client.notification.stop();

        expect(groupRemove).toHaveBeenCalled();
        expect(updateError).not.toHaveBeenCalled();
    });

    it('marks deleted objects as dxDeleted', function() {
        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }]
        }, true);

        var groups = client.getServerCollection('Group');
        groups.$$list();
        server.respond();
        var group = groups.first();

        server.deleteObjects(['GROUP-1']);

        client.notification.start();
        server.respond();
        client.notification.stop();

        expect(group._dxDeleted).toBe(true);
    });

    it('adds new objects in a collection', function() {
        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }],
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: 'Group',
                object: 'GROUP-2'
            }]
        }, true);

        // Get the current collection state
        var groups = client.getServerCollection('Group');
        groups.$$list();
        server.respond();
        expect(groups.get('GROUP-2')).toBeUndefined();

        // Add new the group and fetch pending notifications
        server.createObjects([{
            type: 'Group',
            name: 'b',
            reference: 'GROUP-2'
        }], true);
        var groupAdd = jasmine.createSpy('groupAdd');
        groups.on('add', groupAdd);
        client.notification.start();
        server.respond();
        client.notification.stop();
        groups.off();

        expect(groupAdd).toHaveBeenCalled();
        expect(groups.get('GROUP-2').get('name')).toEqual('b');
    });

    it('removes objects from a collection', function() {
        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }],
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'DELETE',
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        }, true);

        // Get the current collection state
        var groups = client.getServerCollection('Group');
        groups.$$list();
        server.respond();
        expect(groups.get('GROUP-1').get('name')).toEqual('a');

        // Remove the group and fetch pending notifications
        var groupRemove = jasmine.createSpy('groupRemove');
        groups.on('remove', groupRemove);
        server.clearCollection('Group');
        client.notification.start();
        server.respond();
        client.notification.stop();
        groups.off();

        expect(groupRemove).toHaveBeenCalled();
        expect(groups.get('GROUP-1')).toBeUndefined();
    });

    it('ignores new objects for types it doesn\'t have a collection for', function() {
        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }],
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: 'Group',
                object: 'GROUP-2'
            }]
        }, true);

        spyOn(client._cache, 'getCachedModel');
        client.notification.start();
        server.respond();

        client.notification.stop();
        expect(client._cache.getCachedModel).not.toHaveBeenCalled();
    });

    it('fetches an update, when we have a collection, but not the instance', function() {
        server.createObjects({
            Group: [{
                name: 'a',
                age: 23,
                reference: 'GROUP-1'
            }, {
                name: 'b',
                age: 24,
                reference: 'GROUP-2'
            }]
        });
        var groups = client.getServerCollection('Group');
        groups.$$list({
            age: 23
        });
        server.respond();
        dx.test.assert(groups.length).toBe(1);

        spyOn(client._cache, 'getCachedModel').and.callThrough();
        server.updateObjects([{
            name: 'UpdatedName',
            reference: 'GROUP-2'
        }]);
        client.notification.start();

        server.respond();

        client.notification.stop();
        expect(client._cache.getCachedModel).toHaveBeenCalled();
    });

    it('ignores unknown collection types', function() {
        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }],
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Groupie',
                object: 'GROUP-2'
            }, {
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        });

        spyOn(dx, 'fail').and.callFake(function() {
            throw new Error('placeholder exception');
        });
        var warnSpy = spyOn(dx, 'warn');

        // Get the current collection state
        var groups = client.getServerCollection('Group');
        groups.$$list();
        server.respond();
        server.updateObjects([{ reference: 'GROUP-1', name: 'b' }]);
        client.notification.start();
        server.respond();

        client.notification.stop();
        expect(warnSpy).toHaveBeenCalled();
        expect(groups.get('GROUP-1').get('name')).toEqual('b');
    });

    it('reports a warning when asked to update an unknown singleton types', function() {
        server.createObjects({
            Notification: [ {
                type: 'SingletonUpdate',
                objectType: 'BogusSingletonType'
            }]
        });
        spyOn(dx, 'fail');  // block message from mock server
        var warnSpy = spyOn(dx, 'warn');

        // Get the current collection state
        client.notification.start();
        server.respond();

        client.notification.stop();
        expect(warnSpy).toHaveBeenCalled();
    });

    it('reports a warning when something goes wrong while fetching an object', function() {
        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }],
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Group',
                object: 'GROUP-199'
            }]
        });
        var groups = client.getServerCollection('Group');
        groups.$$list();
        server.respond();
        var warnSpy = spyOn(dx, 'warn');

        // Get the current collection state
        client.notification.start();
        server.respond();

        client.notification.stop();
        expect(warnSpy).toHaveBeenCalled();
    });

    it('cleans up error listener if fetching object is successful', function() {
        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }],
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        });

        var warnSpy = spyOn(dx, 'warn');

        client.notification.start();
        server.respond();
        dx.test.assert(warnSpy).not.toHaveBeenCalled();

        var model = client.getServerModel('GROUP-1', 'Group');
        model.trigger('error');
        server.respond();   // clean up server call to get the server model
        client.notification.stop();

        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('cleans up ready listener if error while fetching object', function() {
        server.createObjects({
            Group: [ {
                name: 'a',
                reference: 'GROUP-1'
            }, {
                name: 'b',
                reference: 'GROUP-99'
            }],
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Group',
                object: 'GROUP-99'
            }]
        });
        client.notification.start();
        server.respond();

        var model = client.getServerModel('GROUP-99', 'Group');
        spyOn(model, 'off');
        client.notification.stop();

        expect(model.off).not.toHaveBeenCalled();
        server.respond();   // clean up server call to get the server model
    });

    it('continues to fetch additional notifications after starting', function() {
        server.createObjects({
            Group: [],
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        });

        // Get the current collection state
        var groups = client.getServerCollection('Group');
        groups.$$list();
        server.respond();

        // Add new the group and fetch pending notifications
        server.createObjects([{
            type: 'Group',
            name: 'a',
            reference: 'GROUP-1'
        }], true);
        client.notification.start();
        server.respond();

        expect(groups.get('GROUP-1').get('name')).toEqual('a');

        server.createObjects([{
            type: 'Group',
            name: 'b',
            reference: 'GROUP-2'
        }]);
        server.respond();

        expect(groups.get('GROUP-2').get('name')).toEqual('b');

        client.notification.stop();
    });

    it('retries on error', function() {
        server.createObjects({});
        var ajaxSpy = spyOn(dx.core.ajax, 'ajaxCall').and.callFake(function(options) {
            options.error({
                readyState: 4,
                status: 400,
                statusText: 'error',
                responseText: null
            }, 'error', null);
        });
        var errorSpy = spyOn(dx, 'warn');
        clock.install();
        client.notification.start();

        expect(ajaxSpy).toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();

        clock.tick(client.notification._getRetryTimeout());
        expect(dx.core.ajax.ajaxCall.calls.count()).toEqual(2);

        client.notification.stop();
    });

    it('doesn\'t retry on error after stop() is called', function() {
        clock.install();
        spyOn(dx, 'warn'); // suppress warning message
        server.createObjects({});
        var ajaxSpy = spyOn(dx.core.ajax, 'ajaxCall').and.callFake(function(options) {
            options.error({
                readyState: 4,
                status: 400,
                statusText: 'error',
                responseText: null
            }, 'error', null);
        });
        client.notification.start();
        client.notification.stop();

        expect(ajaxSpy).toHaveBeenCalled();

        clock.tick(client.notification._getRetryTimeout());
        expect(dx.core.ajax.ajaxCall.calls.count()).toEqual(1);
    });

    it('stops running when stop() is called', function() {
        server.createObjects({});

        client.notification.start();
        client.notification.stop();
        server.respond();

        spyOn(dx.core.ajax, 'ajaxCall').and.callThrough();
        server.respond();
        expect(dx.core.ajax.ajaxCall.calls.count()).toEqual(0);
    });

    it('fetches changes when a singleton object is updated', function() {
        server.createObjects({
            HappySingleton: {
                harmonicaColor: 'blue'
            },
            Notification: [ {
                type: 'SingletonUpdate',
                objectType: 'HappySingleton'
            }]
        });

        // Get the current singleton state
        var system = client.getServerSingleton('HappySingleton');
        server.respond();
        expect(system.get('harmonicaColor')).toEqual('blue');

        // Update the hostname, and fetch any pending notifications
        var systemChange = jasmine.createSpy();
        system.on('change', systemChange);
        server.updateObjects([{ type: 'HappySingleton', harmonicaColor: 'newColor'}]);
        client.notification.start();
        server.respond();
        system.off();

        expect(systemChange).toHaveBeenCalled();
        expect(system.get('harmonicaColor')).toEqual('newColor');
        client.notification.stop();
    });

    it('retrieves an object one time, even if named multiple (CREATE and UPDATE) in notification stream', function() {
        server.createObjects({
            Group: [{
                reference: 'GROUP-1'
            }],
            Notification: [{
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }, {
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }, {
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        });
        var groups = client.getServerCollection('Group');
        groups.$$list();
        server.respond();

        spyOn(client._cache, 'getCachedModel').and.callThrough();
        client.notification.start();
        server.respond();

        expect(client._cache.getCachedModel.calls.count()).toBe(1);
        client.notification.stop();
    });

    it('only honors a delete notification if create and update and delete notifications are all in queue', function() {
        server.createObjects({
            Group: [{
                reference: 'GROUP-1'
            }],
            Notification: [{
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }, {
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: 'Group',
                object: 'GROUP-1'
            }, {
                type: 'ObjectNotification',
                eventType: 'DELETE',
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        }, true);
        var groups = client.getServerCollection('Group');
        groups.$$list();
        server.respond();

        spyOn(client._cache, 'getCachedModel').and.callThrough();
        spyOn(client._cache, 'deleteCachedModel').and.callThrough();
        client.notification.start();
        server.respond();

        expect(client._cache.getCachedModel.calls.count()).toBe(0);
        expect(client._cache.deleteCachedModel.calls.count()).toBe(1);
        client.notification.stop();
    });

    it('only retrieves a singleton one time, even if there are multiple notifications for it in queue', function() {
        server.createObjects({
            HappySingleton: {
                harmonicaColor: 'magenta'
            },
            Notification: [{
                type: 'SingletonUpdate',
                objectType: 'HappySingleton'
            }, {
                type: 'SingletonUpdate',
                objectType: 'HappySingleton'
            }, {
                type: 'SingletonUpdate',
                objectType: 'HappySingleton'
            }]
        });
        spyOn(client._cache, 'getCachedSingleton').and.callThrough();

        client.notification.start();
        server.respond();

        expect(client._cache.getCachedSingleton.calls.count()).toBe(1);
        client.notification.stop();
    });

    it('will ignore notification request that returns after stop() is called', function() {
        server.createObjects({
            HappySingleton: {
                harmonicaColor: 'fucia'
            }
        });
        client.notification.start();
        var system = client.getServerSingleton('HappySingleton');
        server.respond();
        server.updateObjects({
            HappySingleton: {
                harmonicaColor: 'zombieGreen'
            }
        });
        expect(system.get('harmonicaColor')).toEqual('fucia');

        client.notification.stop();
        server.respond();

        expect(system.get('harmonicaColor')).toEqual('fucia');
    });

    it('has no problems when asked to remove an object which isn\'t currently in a collection', function() {
        server.createObjects({
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'DELETE',
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        });

        expect(function() {
            client.notification.start();
            server.respond();
            client.notification.stop();
        }).not.toThrow();
    });

    it('reports an error if called with an unknown event type', function() {
        spyOn(dx, 'warn');
        server.createObjects({
            Notification: [ {
                type: 'ObjectNotification',
                eventType: null,
                objectType: 'Group',
                object: 'GROUP-1'
            }]
        });

        client.notification.start();
        server.respond();
        expect(dx.warn).toHaveBeenCalled();
        client.notification.stop();
    });

    it('ignores object types it has never heard of', function() {
        server.createObjects({
            Notification: [ {
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: 'Fish',
                object: 'GROUP-2'
            }]
        });
        /*
         * This strange construction is because we need the underlying call to fail to throw an exception
         * so the next layer of code above will react correctly (notification has a try catch)
         */
        spyOn(dx, 'warn');
        spyOn(dx, 'fail').and.callFake(function(message) {throw new Error(message); });

        client.notification.start();
        server.respond();
        client.notification.stop();

        expect(dx.warn.calls.mostRecent().args[0]).toBe('notification processing failed: Fish is not a known type name.');
    });

    it('will reload the browser page if it receives an object dropped notification', function() {
        spyOn(dx.core.util, 'reloadClient');
        server.createObjects({
            Notification: [ {
                type: 'NotificationDrop',
                dropCount: 34
            }]
        });

        client.notification.start();
        server.respond();
        client.notification.stop();
        expect(dx.core.util.reloadClient).toHaveBeenCalledWith('[dx.notification_drop]');
    });

    it('throws an error if start() called twice', function() {
        client.notification.start();
        expect(function() {
            client.notification.start();
        }).toDxFail('Notification system already started.');
        client.notification.stop();
    });

    it('reports a warning if the call to the notification system fails', function() {
        clock.install();
        spyOn(dx, 'warn');
        var callback;
        spyOn(dx.core.ajax, 'ajaxCall').and.callFake(function(options) {
            callback = options;
        });
        client.notification.start();

        callback.error({
            readyState: 4,
            status: 400,
            statusText: 'error',
            responseText: null
        }, 'error', null);

        expect(dx.warn.calls.mostRecent().args[0]).toBe('Notification call failed.');
        client.notification.stop();
    });

    it('reports no warning if the call to the notification system fails after the system was stopped', function() {
        spyOn(dx, 'warn');
        var callback;
        spyOn(dx.core.ajax, 'ajaxCall').and.callFake(function(options) {
            callback = options;
        });
        client.notification.start();

        client.notification.stop();
        callback.error({
            readyState: 4,
            status: 400,
            statusText: 'error',
            responseText: null
        }, 'error', null);

        expect(dx.warn.calls.count()).toBe(0);
    });
});
