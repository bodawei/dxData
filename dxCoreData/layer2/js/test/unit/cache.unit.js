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

'use strict';

/*eslint-env jasmine */
/*global dx, $ */

describe('dx.core.data._cache', function() {
    var target;
    var SIMPLE_MODEL = {
        type: 'Simple',
        reference: 'MODEL-1',
        favorite: 'red'
    };
    var SIMPLE_MODEL2 = {
        type: 'Simple',
        reference: 'MODEL-2',
        favorite: 'fucia'
    };
    var ajaxSpy;

    function makeReadyCollection() {
        var collection = target._newServerCollection('Simple');
        ajaxSpy.andCallFake(function(options) {
            options.success({
                type: 'ListResult',
                result: [{
                    type: 'Simple',
                    reference: 'MODEL-1',
                    favorite: 'Chocolate'
                }]
            });
        });
        collection.$$list();

        return collection;
    }

    function makeCreationListener() {
        return new dx.core.data.CreationListener({
            typeName: 'Simple',
            callback: function() {},
            disposeCallback: function() {},
            context: target
        });
    }

    beforeEach(function() {
        target = {};

        var singleton = {
            name: 'SingletonType',
            root: '/somewhere',
            singleton: true,
            properties: {
                type: { type: 'string' },
                name: { type: 'string' }
            }
        };

        var ordinary = {
            name: 'Simple',
            root: '/somewhere',
            list: {},
            properties: {
                type: { type: 'string' },
                reference: { type: 'string' },
                favorite: { type: 'string' }
            }
        };

        var nonCachable = {
            name: 'NonCacheable',
            root: '/somewhere',
            list: {},
            properties: {
                type: { type: 'string' },
                name: { type: 'string' }
            }
        };

        var noProps = {
            name: 'NoProps',
            root: '/somewhereelse'
        };

        var schemas = dx.core.data._prepareSchemas({
            s: singleton,
            o: ordinary,
            n: nonCachable,
            p: noProps,
            call: dx.test.dataMocks.callResultSchema,
            api: dx.test.dataMocks.apiErrorSchema,
            e: dx.test.dataMocks.errorResultSchema
        });
        dx.core.data._initFilters(target);
        dx.core.data._initCache(target);
        target._filters.Simple = function(collection, model, handler) {
            handler(target._filters.INCLUDE);
        };
        dx.core.data._generateModelConstructors(schemas, target);
        dx.core.data._generateCollectionConstructors(schemas, target);
        ajaxSpy = spyOn($, 'ajax');
    });

    describe('getCachedSingleton()', function() {
        it('will throw an error if called with a non-string.', function() {
            expect(function() {
                target._cache.getCachedSingleton(43.2);
            }).toDxFail(new Error('A type name must be passed to get the singleton.'));
        });

        it('will throw an error if called with an unknown type.', function() {
            expect(function() {
                target._cache.getCachedSingleton('BogusSingleton');
            }).toDxFail(new Error('BogusSingleton is not a known type name.'));
        });

        it('will throw an error if called with a non-singleton type name.', function() {
            expect(function() {
                target._cache.getCachedSingleton('Simple');
            }).toDxFail(new Error('Simple is not a singleton.'));
        });

        it('will return a model when called', function() {
            expect(target._cache.getCachedSingleton('SingletonType')).not.toBeUndefined();
        });

        it('will return the same model when called repeatedly', function() {
            expect(target._cache.getCachedSingleton('SingletonType')).
                toBe(target._cache.getCachedSingleton('SingletonType'));
        });

        it('will fetch the contents the first time the model is created', function() {
            target._cache.getCachedSingleton('SingletonType');

            expect(ajaxSpy.calls.length).toBe(1);
        });

        it('will not fetch the contents the the second time the model is asked for', function() {
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });
            target._cache.getCachedSingleton('SingletonType');
            target._cache.getCachedSingleton('SingletonType');

            expect(ajaxSpy.calls.length).toBe(1);
        });

        it('will fetch a second time if the update parameter is true', function() {
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });
            target._cache.getCachedSingleton('SingletonType');
            target._cache.getCachedSingleton('SingletonType', { update: true});

            expect(ajaxSpy.calls.length).toBe(2);
        });

        it('will not cache the singleton if an error occurrs while fetching it', function() {
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 402
                });
            });
            target._cache.getCachedSingleton('SingletonType');

            expect(target._singletonStore.hasType('SingletonType')).toBe(false);
        });

        it('will report nothing if asked to suppress error handler when an error in fetching happens', function() {
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 402
                });
            });
            spyOn(target, 'reportErrorResult');
            target._cache.getCachedSingleton('SingletonType', {
                suppressDefaultErrorHandler: true
            });

            expect(target.reportErrorResult).not.toHaveBeenCalled();
        });

        describe('callbacks', function() {
            it('will call success handler when a the singleton is fetched', function() {
                var succssSpy = jasmine.createSpy('succesSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'SingletonType'
                    });
                });
                target._cache.getCachedSingleton('SingletonType', {success: succssSpy});

                expect(succssSpy).toHaveBeenCalled();
            });

            it('will call success handler when a an already present singleton is fetched', function() {
                var succssSpy = jasmine.createSpy('succesSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'SingletonType'
                    });
                });
                target._cache.getCachedSingleton('SingletonType');
                target._cache.getCachedSingleton('SingletonType', {success: succssSpy});

                expect(succssSpy).toHaveBeenCalled();
            });

            it('will call error handler when an error occurrs during fetching', function() {
                var errorSpy = jasmine.createSpy('errorSpy');
                var delayedOptions;
                ajaxSpy.andCallFake(function(options) {
                    delayedOptions = options;
                });
                target._cache.getCachedSingleton('SingletonType', {error: errorSpy});
                expect(errorSpy).not.toHaveBeenCalled();

                delayedOptions.error({
                    type: 'ErrorResult'
                });

                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('getCachedModelFromProperties()', function() {
        it('will throw an error if called with a non-object.', function() {
            expect(function() {
                target._cache.getCachedModelFromProperties('Three');
            }).toDxFail(new Error('Must be called with an object that has a type property that is a string value.'));
        });

        it('will throw an error if called with an object without a type property', function() {
            expect(function() {
                target._cache.getCachedModelFromProperties({
                    reference: 'Simple-1'
                });
            }).toDxFail(new Error('Must be called with an object that has a type property that is a string value.'));
        });

        it('will throw an error if type property is not a string', function() {
            expect(function() {
                target._cache.getCachedModelFromProperties({
                    reference: 'ELYSIUM-1',
                    type: true
                });
            }).toDxFail(new Error('Must be called with an object that has a type property that is a string value.'));
        });

        it('will throw an error if the type isn\'t a defined type', function() {
            expect(function() {
                target._cache.getCachedModelFromProperties({
                    reference: 'ELYSIUM-1',
                    type: 'BogusType'
                });
            }).toDxFail(new Error('Don\'t know how to create a model of type BogusType.'));
        });

        it('will return a new instance of a non-cacheable model', function() {
            var model = target._cache.getCachedModelFromProperties({
                type: 'NonCacheable',
                name: 'TestName'
            });
            expect(model.get('name')).toBe('TestName');
        });

        it('will return a new instance of a model with no reference (that isn\'t cachable)', function() {
            var model = target._cache.getCachedModelFromProperties({
                type: 'Simple',
                favorite: 'strawberry'
            });
            expect(model.get('favorite')).toBe('strawberry');
        });

        it('will permit one model to be in multiple collections', function() {
            var collection1 = makeReadyCollection();
            var collection2 = makeReadyCollection();
            target._modelSubscribersStore.add(collection1);
            target._modelSubscribersStore.add(collection2);
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);

            expect(collection1.at(0)).toBe(model);
            expect(collection2.at(0)).toBe(model);
        });

        it('will store new data as a new server model', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);

            expect(target._cache.getCachedModel('MODEL-1', 'Simple').isServerModel()).toBe(true);
            expect(target._cache.getCachedModel('MODEL-1', 'Simple').get('type')).toBe('Simple');
            expect(target._cache.getCachedModel('MODEL-1', 'Simple').get('reference')).toBe('MODEL-1');
        });

        it('will return the same instance when called multiple times', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);

            expect(target._cache.getCachedModel('MODEL-1', 'Simple')).
                toBe(target._cache.getCachedModel('MODEL-1', 'Simple'));
        });

        it('will cache multiple models.', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL2);

            expect(target._cache.getCachedModel('MODEL-1', 'Simple')).toBeDefined();
            expect(target._cache.getCachedModel('MODEL-2', 'Simple')).toBeDefined();
        });

        it('will update an existing model', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            target._cache.getCachedModelFromProperties({
                type: 'Simple',
                reference: 'MODEL-1',
                favorite: 'dragons'
            });

            expect(target._cache.getCachedModel('MODEL-1', 'Simple').get('favorite')).toBe('dragons');
        });

        it('will trigger change event when called for an existing model', function() {
            var model;
            var changeSpy = jasmine.createSpy('changeSpy');
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            model = target._cache.getCachedModel('MODEL-1', 'Simple');
            model.on('change:favorite', changeSpy);

            target._cache.getCachedModelFromProperties({
                type: 'Simple',
                reference: 'MODEL-1',
                favorite: 'dragons'
            });

            expect(changeSpy).toHaveBeenCalled();
        });

        it('will remove the model from the cache and any collections if a fetch delivers a badReference', function() {
            var collection = makeReadyCollection();
            target._modelSubscribersStore.add(collection);
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(true);
            expect(collection.at(0)).toBe(model);

            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404
                });
            });
            target._cache.getCachedModel('MODEL-1', 'Simple', { update: true});

            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(false);
            expect(collection.at(0)).toBeUndefined();
        });

        it('will not cache the model if a non-404 error is returned while initially fetching', function() {
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 402
                });
            });
            target._cache.getCachedModel('MODEL-1', 'Simple', { update: true});

            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(false);
        });

        it('will call the global error handler if an error occurs when fetching', function() {
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 402
                });
            });
            spyOn(target, 'reportErrorResult');
            target._cache.getCachedModel('MODEL-1', 'Simple');

            expect(target.reportErrorResult).toHaveBeenCalled();
        });

        it('will not notify the creation listener if the model changed', function() {
            var callbackSpy = jasmine.createSpy('callbackSpy');
            var creationListener = new dx.core.data.CreationListener({
                typeName: 'Simple',
                context: target,
                callback: callbackSpy
            });
            target._modelSubscribersStore.add(creationListener);
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            model.trigger('change');

            expect(callbackSpy.callCount).toBe(1);
        });
    });

    describe('getCachedModel()', function() {
        it('will throw an error if called with a non-string reference', function() {
            expect(function() {
                target._cache.getCachedModel(23);
            }).toDxFail(new Error('A reference and a type must be passed to get the model.'));
        });

        it('will return an existing model if it is already in the cache.', function() {
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            expect(target._cache.getCachedModel('MODEL-1', 'Simple')).toBe(model);
        });

        it('will create a new model if it isn\'t already in the cache', function() {
            expect(target._cache.getCachedModel('MODEL-1', 'Simple')).toBeDefined();
        });

        it('will issue a fetch request if it is newly created', function() {
            target._cache.getCachedModel('MODEL-1', 'Simple');

            expect(ajaxSpy).toHaveBeenCalled();
        });

        it('will not issue a fetch request if it already existed', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            target._cache.getCachedModel('MODEL-1', 'Simple');

            expect(ajaxSpy).not.toHaveBeenCalled();
        });

        it('will issue a fetch request if it already existed, but update is set to true', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            target._cache.getCachedModel('MODEL-1', 'Simple', { update: true });

            expect(ajaxSpy).toHaveBeenCalled();
        });

        it('will add the model to the cache before receiving any results from the server', function() {
            target._cache.getCachedModel('MODEL-1', 'Simple', { update: true });

            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(true);
        });

        it('will remove the model from the cache on creation if the fetch delivers a badReference', function() {
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404
                });
            });
            target._cache.getCachedModel('MODEL-1', 'Simple', { update: true });

            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(false);
        });

        it('will add the new model to a collection once it has been fetched', function() {
            var collection = makeReadyCollection();
            target._modelSubscribersStore.add(collection);
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'Simple',
                    reference: 'MODEL-1'
                });
            });
            var model = target._cache.getCachedModel('MODEL-1', 'Simple', { update: true });

            expect(collection.at(0)).toBe(model);
        });

        it('will not cache the model if the cacheOnlyIfNeeded option is set, and there are no collections', function() {
            target._cache.getCachedModel('MODEL-1', 'Simple', { update: true, cacheOnlyIfNeeded: true });

            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(false);
        });

        it('will cache the model if the cacheOnlyIfNeeded option is set, and there is a collection', function() {
            var collection = makeReadyCollection();
            target._modelSubscribersStore.add(collection);
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'Simple',
                    reference: 'MODEL-1'
                });
            });
            target._cache.getCachedModel('MODEL-1', 'Simple', { update: true, cacheOnlyIfNeeded: true });

            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(true);
        });

        describe('suppressDefaultErrorHandler', function() {
            it('will not set the suppressDefaultHandlerByDefault', function() {
                var modelSpy = {
                    _dxFetch: jasmine.createSpy(),
                    _dxSet: jasmine.createSpy(),
                    on: jasmine.createSpy(),
                    get: function(prop) {
                        if (prop === 'reference') {
                            return 'ONE-1';
                        } else {
                            return 'Simple';
                        }
                    }
                };
                spyOn(target, '_newServerModel').andReturn(modelSpy);
                target._cache.getCachedModel('MODEL-1', 'Simple');

                expect(modelSpy._dxFetch.argsForCall[0][0].suppressDefaultErrorHandler).toBe(undefined);
            });

            it('passes the suppressDefaultHandlerByDefault options to dxFetch', function() {
                spyOn(target, 'reportErrorResult');
                var modelSpy = {
                    _dxFetch: jasmine.createSpy().andCallFake(function(options) {
                        options.error({});
                    }),
                    _dxSet: jasmine.createSpy(),
                    on: jasmine.createSpy(),
                    off: jasmine.createSpy(),
                    get: function(prop) {
                        if (prop === 'reference') {
                            return 'ONE-1';
                        } else {
                            return 'Simple';
                        }
                    }
                };
                spyOn(target, '_newServerModel').andReturn(modelSpy);
                target._cache.getCachedModel('MODEL-1', 'Simple', {
                    suppressDefaultErrorHandler: true
                });

                expect(target.reportErrorResult).not.toHaveBeenCalled();
            });
        });
    });

    describe('containsCachedModel()', function() {
        it('will throw an error if called with no arguments', function() {
            expect(function() {
                target._cache.containsCachedModel();
            }).toDxFail(new Error('A reference and a type must be passed to check on the model.'));
        });

        it('will throw an error if called without a type', function() {
            expect(function() {
                target._cache.containsCachedModel('REF-1');
            }).toDxFail(new Error('A reference and a type must be passed to check on the model.'));
        });

        it('will return false if the model doesn\'t exist', function() {
            expect(target._cache.containsCachedModel('REF-1', 'Simple')).toBe(false);
        });
    });

    describe('deleteCachedModel()', function() {
        it('will throw an error if called with no arguments', function() {
            expect(function() {
                target._cache.deleteCachedModel();
            }).toDxFail(new Error('A reference and a type must be passed to delete a model.'));
        });

        it('will throw an error if called without a type', function() {
            expect(function() {
                target._cache.deleteCachedModel('REF-1');
            }).toDxFail(new Error('A reference and a type must be passed to delete a model.'));
        });

        it('will trigger a delete event on the model', function() {
            var deleteSpy = jasmine.createSpy('deleteSpy');
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            model.on('delete', deleteSpy);

            target._cache.deleteCachedModel('MODEL-1', 'Simple');

            expect(deleteSpy).toHaveBeenCalled();
        });

        it('will remove from any collections before triggering a delete event', function() {
            var deleteSpy = jasmine.createSpy('deleteSpy');
            var hasModel = true;
            var collection = makeReadyCollection();
            target._modelSubscribersStore.add(collection);
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            model.on('delete', deleteSpy);
            deleteSpy.andCallFake(function() {
               hasModel = (collection.length === 0);
            });

            target._cache.deleteCachedModel('MODEL-1', 'Simple');

            expect(hasModel).toBe(true);
        });

        it('will not trigger a delete event on the model, if the dontTriggerDelete flag is true', function() {
            var deleteSpy = jasmine.createSpy('deleteSpy');
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            model.on('delete', deleteSpy);

            target._cache.deleteCachedModel('MODEL-1', 'Simple', true);

            expect(deleteSpy).not.toHaveBeenCalled();
        });

        it('will clear the model', function() {
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            expect(model.get('favorite')).toEqual('red');

            target._cache.deleteCachedModel('MODEL-1', 'Simple');

            expect(model.get('favorite')).toBeUndefined();
        });

        it('will remove the model from the cache', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(true);

            target._cache.deleteCachedModel('MODEL-1', 'Simple');

            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(false);
        });

        it('will remove the model from the cache, even when there are multiple there', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL2);
            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(true);

            target._cache.deleteCachedModel('MODEL-1', 'Simple');

            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toBe(false);
        });

        it('will do nothing if asked to remove a model that doesn\'t exist', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL2);
            expect(function() {
                target._cache.deleteCachedModel('REF-1', 'Simple');
            }).not.toThrow();
        });

        it('will remove the model from any collections', function() {
            var collection = makeReadyCollection();
            target._modelSubscribersStore.add(collection);
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            expect(collection.at(0)).toBe(model);

            target._cache.deleteCachedModel('MODEL-1', 'Simple');

            expect(collection.at(0)).toBeUndefined();
        });

        it('will not add the model back into the collection when it is deleted and then altered.', function() {
            var collection = makeReadyCollection();
            target._modelSubscribersStore.add(collection);
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            expect(collection.at(0)).toBe(model);
            target._cache.deleteCachedModel('MODEL-1', 'Simple');

            model._dxSet('favorite', 'SoSad');

            expect(collection.at(0)).toBeUndefined();
        });

        it('will not throw an error if asked to remove a model from a creationListener', function() {
            var creationListener = makeCreationListener();
            target._modelSubscribersStore.add(creationListener);
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);

            expect(function() {
                target._cache.deleteCachedModel('MODEL-1', 'Simple');
            }).not.toDxFail();
        });

    });

    describe('reset()', function() {
        it('it will remove any models already in the cache', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            target._cache.getCachedSingleton('SingletonType');
            var collection = target._newServerCollection('Simple');
            target._modelSubscribersStore.add(collection);

            target._cache.reset();

            expect(target._cache.containsCachedModel('MODEL-1', 'Simple')).toEqual(false);
        });
    });

    describe('isTypeCachable()', function() {

        it('it will return false if asked for an unknown type', function() {
            expect(target._cache.isTypeCachable('Bogus')).toEqual(false);
        });

        it('it will return false if asked for a type with no properties', function() {
            expect(target._cache.isTypeCachable('NoProps')).toEqual(false);
        });

    });

    describe('dump()', function() {
        it('reports nothing when there\'s nothing in the cache', function() {
            spyOn(dx, 'info');

            target._cache.dump();

            expect(dx.info.calls[0].args[0]).toEqual('SUBSCRIBERS');
            expect(dx.info.calls[1].args[0]).toEqual('===========');
            expect(dx.info.calls[2].args[0]).toEqual({});
            expect(dx.info.calls[3].args[0]).toEqual('');
            expect(dx.info.calls[4].args[0]).toEqual('SINGLETONS');
            expect(dx.info.calls[5].args[0]).toEqual('==========');
            expect(dx.info.calls[6].args[0]).toEqual({});
            expect(dx.info.calls[3].args[0]).toEqual('');
            expect(dx.info.calls[8].args[0]).toEqual('SERVER MODELS');
            expect(dx.info.calls[9].args[0]).toEqual('=============');
            expect(dx.info.calls[10].args[0]).toEqual({});
        });

        it('reports the contents of the cache when called', function() {
            var model = target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            var singleton = target._cache.getCachedSingleton('SingletonType');
            spyOn(dx, 'info');

            target._cache.dump();

            expect(dx.info.calls[0].args[0]).toEqual('SUBSCRIBERS');
            expect(dx.info.calls[1].args[0]).toEqual('===========');
            expect(dx.info.calls[2].args[0]).toEqual({});
            expect(dx.info.calls[3].args[0]).toEqual('');
            expect(dx.info.calls[4].args[0]).toEqual('SINGLETONS');
            expect(dx.info.calls[5].args[0]).toEqual('==========');
            expect(dx.info.calls[6].args[0]).toEqual({
                SingletonType: singleton
            });
            expect(dx.info.calls[7].args[0]).toEqual('');
            expect(dx.info.calls[8].args[0]).toEqual('SERVER MODELS');
            expect(dx.info.calls[9].args[0]).toEqual('=============');
            expect(dx.info.calls[10].args[0]).toEqual({
                Simple: {
                    'MODEL-1': model
                }
            });
        });
    });

    describe('dumpText()', function() {
        it('reports nothing is in the cache if there is nothing in it', function() {
            var lines = '';
            spyOn(dx, 'info').andCallFake(function(line) {
                lines = lines + line + '\n';
            });

            target._cache.dumpText();

            expect(lines).toEqual('SUBSCRIBERS\n===========\nNone.\n\nSINGLETONS\n==========\nNone.\n\nSERVER ' +
                'MODELS\n=============\nNone.\n');
        });

        it('reports a creation listener is in the cache if it is', function() {
            var lines = '';
            spyOn(dx, 'info').andCallFake(function(line) {
                lines = lines + line + '\n';
            });
            var creationListener = makeCreationListener();
            target._modelSubscribersStore.add(creationListener);

            target._cache.dumpText();

            expect(lines).toEqual('SUBSCRIBERS\n===========\nSimple\n-------------\nNotification Listener with query ' +
                'params: None\n\nSINGLETONS\n==========\nNone.\n\nSERVER MODELS\n=============\nNone.\n');
        });

        it('reports a creation listener is in the cache with query parameters if it is', function() {
            var lines = '';
            spyOn(dx, 'info').andCallFake(function(line) {
                lines = lines + line + '\n';
            });
            var creationListener = new dx.core.data.CreationListener({
                typeName: 'Simple',
                context: target,
                callback: function() {},
                queryParams: {
                    a: 5
                }
            });
            target._modelSubscribersStore.add(creationListener);

            target._cache.dumpText();

            expect(lines).toEqual('SUBSCRIBERS\n===========\nSimple\n-------------\nNotification Listener with query ' +
                'params: {"a":5}\n\nSINGLETONS\n==========\nNone.\n\nSERVER MODELS\n=============\nNone.\n');
        });

        it('reports the contents of the cache as text when called', function() {
            target._cache.getCachedModelFromProperties(SIMPLE_MODEL);
            target._cache.getCachedSingleton('SingletonType');
            var lines = '';
            spyOn(dx, 'info').andCallFake(function(line) {
                lines = lines + line + '\n';
            });

            target._cache.dumpText();

            expect(lines).toEqual('SUBSCRIBERS\n===========\nNone.\n\nSINGLETONS\n==========\nSingletonType\n\n' +
                'SERVER MODELS\n=============\nSimple\n-------------\nMODEL-1\n   badReference : 1 listeners\n' +
                '   change : 1 listeners\n');
        });
    });

    describe('prune()', function() {

        it('calls prune on each of the underlying stores (whitebox)', function() {
            spyOn(target._modelSubscribersStore, 'prune');
            spyOn(target._singletonStore, 'prune');
            spyOn(target._modelStore, 'prune');

            target._cache.prune();

            expect(target._modelSubscribersStore.prune).toHaveBeenCalled();
            expect(target._singletonStore.prune).toHaveBeenCalled();
            expect(target._modelStore.prune).toHaveBeenCalled();
        });

    });

    describe('isEmpty()', function() {

        it('returns true if all stores are empty (whitebox)', function() {
            spyOn(target._modelSubscribersStore, 'isEmpty').andReturn(true);
            spyOn(target._singletonStore, 'isEmpty').andReturn(true);
            spyOn(target._modelStore, 'isEmpty').andReturn(true);

            expect(target._cache.isEmpty()).toBe(true);
        });

        it('returns false if any stores is not empty (whitebox)', function() {
            spyOn(target._modelSubscribersStore, 'isEmpty').andReturn(true);
            spyOn(target._singletonStore, 'isEmpty').andReturn(false);
            spyOn(target._modelStore, 'isEmpty').andReturn(true);

            expect(target._cache.isEmpty()).toBe(false);
        });

    });

    describe('SubcribersStore', function() {
        var store;
        var collection1;
        var collection2;
        var creationListener;

        beforeEach(function() {
            collection1 = makeReadyCollection();
            collection2 = makeReadyCollection();
            creationListener = makeCreationListener();
            store = target._modelSubscribersStore;
        });

        afterEach(function() {
            collection1.off();
            collection2.off();
            store.reset();
        });

        describe('add()', function() {

            it('adds a collection to the store', function() {
                store.add(collection1);

                expect(store._modelSubscribers.Simple.length).toBe(1);
            });

            it('will not add the same collection twice', function() {
                store.add(collection1);
                store.add(collection1);

                expect(store._modelSubscribers.Simple.length).toBe(1);
            });

            it('adds a notifcation listener to the store', function() {
                store.add(creationListener);
                expect(store._modelSubscribers.Simple.length).toBe(1);
            });
        });

        describe('remove()', function() {

            it('removes the collection from the store', function() {
                store.add(collection1);
                store.add(collection2);
                store.add(creationListener);
                store.remove(collection2);

                expect(store._modelSubscribers.Simple.length).toBe(2);
                expect(store._modelSubscribers.Simple[0]).toBe(collection1);
                expect(store._modelSubscribers.Simple[1]).toBe(creationListener);
            });

            it('removes the notification listener from the store', function() {
                store.add(creationListener);
                store.add(collection1);
                store.remove(creationListener);

                expect(store._modelSubscribers.Simple.length).toBe(1);
                expect(store._modelSubscribers.Simple[0]).toBe(collection1);
            });

            it('removes the set of collections if the collection being removed is the last', function() {
                store.add(collection1);

                store.remove(collection1);

                expect(store._modelSubscribers.Simple).toBeUndefined();
            });

            it('does not alter the store if asked to remove a collection that isn\'t there', function() {
                store.add(collection1);

                store.remove(collection2);

                expect(store._modelSubscribers.Simple.length).toBe(1);
            });

        });

        describe('getAllOfType()', function() {

            it('returns all the collections of the specified type', function() {
                store.add(collection1);
                store.add(collection2);

                expect(store.getAllOfType('Simple')[0]).toBe(collection1);
                expect(store.getAllOfType('Simple')[1]).toBe(collection2);
            });

            it('returns an empty list if asked for a type which isn\'t present', function() {
                expect(store.getAllOfType('Simple')).toEqual([]);
            });

        });

        describe('hasType()', function() {

            it('returns true if there are collections of the specified type', function() {
                store.add(collection1);

                expect(store.hasType('Simple')).toBe(true);
            });

            it('returns false if there are collections of the specified type', function() {
                expect(store.hasType('Simple')).toBe(false);
            });

        });

        describe('reset()', function() {

            it('removes all collections from the store', function() {
                store.add(collection1);
                store.add(collection2);
                store.add(creationListener);

                store.reset();

                expect(store._modelSubscribers).toEqual({});
            });

            it('empties all collections that it removes from the store', function() {
                store.add(collection1);
                store.add(collection2);
                store.add(creationListener);
                dx.test.assert(collection1.length).toBe(1);

                store.reset();

                expect(collection1.length).toBe(0);
            });

        });

        describe('prune()', function() {

            it('removes all collections in the store that have no associated events and aren\'t in use', function() {
                store.add(collection1);
                store.add(collection2);
                store.add(creationListener);
                creationListener.dispose();

                store.prune();

                expect(store._modelSubscribers.Simple).toBeUndefined();
            });

            it('leaves collections in the store that have associated events', function() {
                store.add(collection1);
                store.add(collection2);
                store.add(creationListener);
                collection1.on('someEvent', function() {});

                store.prune();

                expect(store._modelSubscribers.Simple.length).toBe(2);
            });
        });

        describe('isEmpty()', function() {

            it('returns true if there are no collections in the store', function() {
                expect(store.isEmpty()).toBe(true);
            });

            it('returns false if the store is not empty (whitebox)', function() {
                store.add(collection1);

                expect(store.isEmpty()).toBe(false);
            });

        });

        describe('dump()', function() {
            var lines;

            beforeEach(function() {
                lines = '';
                spyOn(dx, 'info').andCallFake(function(line) {
                    lines = lines + line + '\n';
                });
            });

            it('prints out the actual store of collections', function() {

                store.dump();

                expect(lines).toBe('SUBSCRIBERS\n===========\n[object Object]\n');
            });

        });

        describe('dumpText()', function() {
            var lines;

            beforeEach(function() {
                lines = '';
                spyOn(dx, 'info').andCallFake(function(line) {
                    lines = lines + line + '\n';
                });
            });

            it('shows a "none" message when there are no collections', function() {

                store.dumpText();

                expect(lines).toBe('SUBSCRIBERS\n===========\nNone.\n');
            });

            it('shows details about collections', function() {
                collection1.on('anEvent', function() {});
                store.add(collection1);

                store.dumpText();

                expect(lines).toBe('SUBSCRIBERS\n===========\nSimple\n-------------\nCollection with 1 elements.\n' +
                    '   anEvent : 1 listeners\n');
            });

        });

    });

    describe('SingletonStore', function() {
        var store;
        var singleton;

        beforeEach(function() {
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'SingletonType'
                });
            });
            singleton = target._newServerModel('SingletonType');
            store = new target._cache._SingletonStore();
        });

        afterEach(function() {
            singleton.off();
            store.reset();
        });

        describe('add()', function() {

            it('adds a singleton to the store', function() {
                store.add(singleton);

                expect(store.get('SingletonType')).toBe(singleton);
            });

        });

        describe('get()', function() {

            it('returns a singleton from the store', function() {
                store.add(singleton);

                expect(store.get('SingletonType')).toBe(singleton);
            });

            it('undefined if the specified singleton is not present', function() {
                expect(store.get('BogusType')).toBeUndefined();
            });

        });

        describe('remove()', function() {

            it('removes the singleton from the store', function() {
                store.add(singleton);

                store.remove(singleton);

                expect(store.get('SingletonType')).toBeUndefined();
            });

            it('does nothing if asked to remove a singleton that isn\'t in the store', function() {
                store.remove(singleton);

                expect(store.get('SingletonType')).toBeUndefined();
            });

        });

        describe('hasType()', function() {

            it('returns true if there is a singleton of the specified type', function() {
                store.add(singleton);

                expect(store.hasType('SingletonType')).toBe(true);
            });

            it('returns false if there is not a singleton of the specified type', function() {
                expect(store.hasType('Bogus')).toBe(false);
            });

        });

        describe('reset()', function() {

            it('removes all singletons from the store', function() {
                store.add(singleton);

                store.reset();

                expect(store._singletons).toEqual({});
            });

        });

        describe('prune()', function() {

            it('empties all singletons in the store that have no event listeners', function() {
                store.add(singleton);

                store.prune();

                expect(store._singletons).toEqual({});
            });

            it('empties all collections in the store that have no event listenrs', function() {
                store.add(singleton);
                singleton.on('someEvent', function() {});

                store.prune();

                expect(store.get('SingletonType')).toBe(singleton);
            });
        });

        describe('isEmpty()', function() {

            it('returns true if there are no singletons in the store', function() {
                expect(store.isEmpty()).toBe(true);
            });

            it('returns false if the store is not empty (whitebox)', function() {
                store.add(singleton);

                expect(store.isEmpty()).toBe(false);
            });

        });

        describe('dump()', function() {
            var lines;

            beforeEach(function() {
                lines = '';
                spyOn(dx, 'info').andCallFake(function(line) {
                    lines = lines + line + '\n';
                });
            });

            it('prints out the actual store of singletons', function() {

                store.dump();

                expect(lines).toBe('SINGLETONS\n==========\n[object Object]\n');
            });

        });

        describe('dumpText()', function() {
            var lines;

            beforeEach(function() {
                lines = '';
                spyOn(dx, 'info').andCallFake(function(line) {
                    lines = lines + line + '\n';
                });
            });

            it('shows a "none" message when there are no singletons', function() {

                store.dumpText();

                expect(lines).toBe('SINGLETONS\n==========\nNone.\n');
            });

            it('shows details about a singleton', function() {
                store.add(singleton);
                singleton.on('anEvent', function() {});
                store.add(singleton);

                store.dumpText();

                expect(lines).toBe('SINGLETONS\n==========\nSingletonType\n   anEvent : 1 listeners\n');
            });

        });

    });

    describe('ModelStore', function() {
        var store;
        var model1;
        var model2;

        beforeEach(function() {
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult',
                    result: SIMPLE_MODEL
                });
            });

            model1 = target._newServerModel('Simple');
            model1._dxFetch();

            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult',
                    result: SIMPLE_MODEL2
                });
            });
            model2 = target._newServerModel('Simple');
            model2._dxFetch();

            store = new target._cache._ModelStore(target);
        });

        describe('add()', function() {

            it('adds a model to the store', function() {
                store.add(model1);

                expect(store.get('MODEL-1')).toBe(model1);
            });

            it('throws an error if one tries to add a model with an undefined reference', function() {
                model1.attributes.reference = undefined;

                expect(function() {
                    store.add(model1);
                }).toDxFail('Can not cache a model with no reference (type is: Simple).');
            });
        });

        describe('get()', function() {

            it('returns a model from the store', function() {
                store.add(model1);

                expect(store.get('MODEL-1')).toBe(model1);
            });

            it('returns a model from the store when a type is provided', function() {
                store.add(model1);

                expect(store.get('MODEL-1', 'Simple')).toBe(model1);
            });

            it('does not return a model from the store when the wrong type is provided', function() {
                store.add(model1);

                expect(store.get('MODEL-1', 'Bogus')).toBeUndefined();
            });

            it('returns undefined when trying to retrieve a model which isn\'t in the store', function() {
                expect(store.get('MODEL-1')).toBeUndefined();
            });

            it('returns undefined when retrieving a model from a store with another model in it', function() {
                store.add(model2);

                expect(store.get('MODEL-1')).toBeUndefined();
            });

        });

        describe('remove()', function() {

            it('removes the model from the store', function() {
                store.add(model1);

                store.remove(model1);

                expect(store.get('MODEL-1')).toBeUndefined();
            });

            it('removes the set of models when the last of that type is removed (whitebox)', function() {
                store.add(model1);

                store.remove(model1);

                expect(store._models.Simple).toBeUndefined();
            });

            it('does nothing if trying to remove a model which isn\'t there', function() {
                expect(function() {
                    store.remove(model1);
                }).not.toDxFail();
            });

            it('removes the model even if it has been cleared', function() {
                store.add(model1);
                model2._dxClear();

                store.remove(model1);

                expect(store._models.Simple).toBeUndefined();
            });

        });

        describe('hasModel()', function() {

            it('returns true if there is a model with the specified reference', function() {
                store.add(model1);

                expect(store.hasModel('MODEL-1')).toBe(true);
            });

            it('returns false if there is no model with the specified reference', function() {
                expect(store.hasModel('MODEL-1')).toBe(false);
            });

        });

        describe('reset()', function() {

            it('removes all models from the store', function() {
                store.add(model1);
                store.add(model2);

                store.reset();

                expect(store._models).toEqual({});
            });

        });

        describe('prune()', function() {

            it('removes all models in the store that have no associated listeners', function() {
                store.add(model1);
                store.add(model2);

                store.prune();

                expect(store.get('MODEL-2')).toBeUndefined();
            });

            it('removes models in the store that had been put into a collection', function() {
                model1.on('change', function() {});
                model1.on('badReference', function() {});
                store.add(model1);

                store.prune();

                expect(store.get('MODEL-1')).toBeUndefined();
            });

            it('does not remove models from the store that have associated listeners', function() {
                store.add(model1);
                store.add(model2);
                model1.on('someEvent', function() {});

                store.prune();

                expect(store.get('MODEL-1')).toBe(model1);
            });
        });

        describe('isEmpty()', function() {

            it('returns true if there are no models in the store', function() {
                expect(store.isEmpty()).toBe(true);
            });

            it('returns false if there are one or more models in the store (whitebox)', function() {
                store.add(model1);

                expect(store.isEmpty()).toBe(false);
            });

            it('returns true if there there was a model in the store, but it was removed', function() {
                store.add(model1);
                store.remove(model1);

                expect(store.isEmpty()).toBe(true);
            });

        });

        describe('dump()', function() {
            var lines;

            beforeEach(function() {
                lines = '';
                spyOn(dx, 'info').andCallFake(function(line) {
                    lines = lines + line + '\n';
                });
            });

            it('prints out the actual store of models', function() {

                store.dump();

                expect(lines).toBe('SERVER MODELS\n=============\n[object Object]\n');
            });

        });

        describe('dumpText()', function() {
            var lines;

            beforeEach(function() {
                lines = '';
                spyOn(dx, 'info').andCallFake(function(line) {
                    lines = lines + line + '\n';
                });
            });

            it('shows a "none" message when there are no models', function() {

                store.dumpText();

                expect(lines).toBe('SERVER MODELS\n=============\nNone.\n');
            });

            it('shows details about models', function() {
                model1.on('anEvent', function() {});
                store.add(model1);

                store.dumpText();

                expect(lines).toBe('SERVER MODELS\n=============\nSimple\n-------------\nMODEL-1\n' +
                    '   anEvent : 1 listeners\n');
            });

        });

    });
});
