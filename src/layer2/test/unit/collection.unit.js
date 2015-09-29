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
 * Copyright (c) 2013, 2015 by Delphix. All rights reserved.
 */

/*eslint-env jasmine */
/*global dx, Backbone, jQuery, _ */

'use strict';

var schema = require('../../../layer1/schema.js');
var initCache = require('../../cache.js');
var generateModelConstructors = require('../../model.js');
var generateCollectionConstructors = require('../../collection.js');
var initFilters = require('../../filter.js');

ddescribe('generateCollectionConstructors', function() {
    var SimpleModelConstructor = Backbone.Model.extend({});
    var target;
    var collection;
    var schemas;

    var GENERATE_INITIAL_RESULTS = function(options) {
            options.success({
                type: 'ListResult',
                result: [ {
                        type: 'hasList',
                        reference: 'WHEE-1'
                    }, {
                        type: 'hasList',
                        reference: 'WHEE-2'
                    } ]
            });
        };

    var GENERATE_PARTIAL_CHANGE = function(options) {
            options.success({
                type: 'ListResult',
                result: [ {
                        type: 'hasList',
                        reference: 'WHEE-2'
                    }, {
                        type: 'hasList',
                        reference: 'WHEE-3'
                    } ]
            });
        };

    var GENERATE_FULL_CHANGE = function(options) {
            options.success({
                type: 'ListResult',
                result: [ {
                        type: 'hasList',
                        reference: 'WHEE-4'
                    }, {
                        type: 'hasList',
                        reference: 'WHEE-5'
                    } ]
            });
        };

    function RETURN_EMPTY_LISTRESULTS(options) {
        options.success({
            type: 'ListResult',
            result: [ ]
        });
    }

    beforeEach(function() {
        target = {};

        var unRooted = {
            name: 'NoRoot',
            properties: { type: { type: 'string' } }
        };
        var rooted = {
            name: 'HasRoot',
            root: '/somewhere',
            list: {
                parameters: {
                    name: { type: 'string' },
                    pageSize: { type: 'integer' }
                }
            },
            properties: {
                type: { type: 'string' },
                reference: { type: 'string' },
                name: { type: 'string' }
            }
        };
        var noqp = {
            name: 'NoQueryParams',
            root: '/noqueryparams',
            list: {
                parameters: {
                }
            },
            properties: {
                type: { type: 'string' },
                reference: { type: 'string' },
                name: { type: 'string' }
            }
        };
        var wmp = {
            name: 'WithMapsTo',
            root: '/withmapsto',
            list: {
                parameters: {
                    name: {
                        type: 'string',
                        mapsTo: 'name'
                    }
                }
            },
            properties: {
                type: { type: 'string' },
                reference: { type: 'string' },
                name: { type: 'string' }
            }
        };
        var rootChild = {
            name: 'ChildOfRoot',
            'extends' : {
                $ref: 'p'
            }
        };

        schemas = schema.prepareSchemas({u: unRooted, p: rooted, c: rootChild, n: noqp, wmp: wmp});
        initCache(target);
        initFilters(target);
        target._filters.HasRoot = function(collection, model, handler) {
            handler(target._filters.INCLUDE);
        };
        generateModelConstructors(schemas, target);
        generateCollectionConstructors(schemas, target);
        collection = target._newServerCollection('HasRoot');
    });

    describe('constructors', function() {
        it('has one constructor for each schema with a list operation', function() {
            generateCollectionConstructors(schemas, target, target);

            expect(_.size(target._collectionConstructors)).toBe(3);
            expect(target._collectionConstructors.HasRoot).toBeDefined();
        });
    });

    describe('model()', function() {
        it('can not be used', function() {
            expect(function() {
                collection.model();
            }).toDxFail(new Error('Can not create a new model on a collection. Must use the cache.'));
        });
    });

    describe('clone()', function() {
        it('will create a copy of the collection with the same models', function() {
            spyOn(jQuery, 'ajax').andCallFake(RETURN_EMPTY_LISTRESULTS);
            collection.$$list();
            collection._dxAddOrRemove(target._newClientModel('HasRoot'));

            var newCollection = collection.clone();
            newCollection.add(target._newClientModel('ChildOfRoot'));

            expect(newCollection.length).toBe(2);
            expect(newCollection.at(0)).toBe(collection.at(0));
        });

        it('will create a read/write copy of the collection, even when the source is a Server Collection', function() {
            collection = target._newServerCollection('HasRoot');

            var newCollection = collection.clone();
            newCollection.add(target._newClientModel('ChildOfRoot'));

            expect(function() {
                newCollection.add(target._newClientModel('ChildOfRoot'));
            }).not.toThrow();
        });
    });

    describe('parse', function() {
        it('returns the array of results if it receives a ListResult', function() {
            var result = collection.parse({
                type: 'ListResult',
                status: 'OK',
                action: '',
                job: '',
                result: [ {foo: 'bar'}, {age: 23} ]
            });

            expect(result).toEqual([ {foo: 'bar'}, {age: 23} ]);
        });

        it('throws an error if encountering a result without a type', function() {
            expect(function() {
                collection.parse({});
            }).toDxFail(new Error('Got a response without a type.'));
        });

        it('throws an error if encountering a result with an unknown type', function() {
            expect(function() {
                collection.parse({
                    type: 'OtherResult'
                });
            }).toDxFail(new Error('Got an unexpected type of response (OtherResult) in parse().'));
        });
    });

    describe('fetch()', function() {
        it('throws an error if called', function() {
            expect(function() {
                collection.fetch();
            }).toDxFail(new Error('Do not call fetch() directly. Instead, call $$list().'));
        });
    });

    // white box testing note: push is mainly the same code as add, so don't test as thoroughly.
    describe('create()', function() {
       it('will throw an error if called', function() {
            expect(function() {
                collection.create({
                    type: 'NoRoot'
                });
            }).toDxFail(new Error('Do not call create() directly. Instead, call rootOps.HasRoot.$$create().'));
        });
    });

    describe('$$list', function() {
        beforeEach(function() {
            var listType = {
                name: 'hasList',
                root: '/somewhere',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    },
                    favorite: {
                        type: 'string'
                    }
                },
                list: {
                    parameters: {
                        param1: {
                            type: 'string'
                        },
                        stringParam: {
                            type: 'string'
                        },
                        nullParam: {
                            type: 'null'
                        },
                        intParam: {
                            type: 'integer'
                        },
                        numberParam: {
                            type: 'number'
                        },
                        booleanParam: {
                            type: 'boolean'
                        },
                        objectParam: {
                            type: 'object'
                        },
                        arrayParam: {
                            type: 'array'
                        },
                        dateParam: {
                            type: 'string',
                            format: 'date'
                        }
                    }
                }
            };

            var noParams = {
                name: 'NoParams',
                root: '/somewhere',
                properties: {
                    type: {
                        type: 'string'
                    }
                },
                list: {}
            };

            var reqType = {
                name: 'RequiredParams',
                root: '/somewhere',
                list: {
                    parameters: {
                        required: {
                            type: 'string',
                            required: true
                        },
                        notRequired: {
                            type: 'string',
                            required: false
                        }
                    }
                }
            };
            var schemas = schema.prepareSchemas({
                p: listType,
                n: noParams,
                r: reqType,
                o: dx.test.dataMocks.okResultSchema,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema
            });
            initCache(target);
            initFilters(target);
            target._filters.hasList = function(collection, model, handler) {
                handler(dx.core.data._filters.INCLUDE);
            };
            target._filters.RequiredParams = function(collection, model, handler) {
                handler(dx.core.data._filters.INCLUDE);
            };
            target._filters.NoParams = function(collection, model, handler) {
                handler(dx.core.data._filters.INCLUDE);
            };
            generateModelConstructors(schemas, target);
            generateCollectionConstructors(schemas, target);
            collection = new target._newServerCollection('hasList');
        });

        it('makes an ajax call when invoked with no parameters', function() {
            var ajaxSpy = spyOn(jQuery, 'ajax');

            collection.$$list();

            expect(ajaxSpy).toHaveBeenCalled();
        });

        it('can be called on a list that has no possible parameters', function() {
            var ajaxSpy = spyOn(jQuery, 'ajax');
            collection = new target._collectionConstructors.NoParams();

            collection.$$list();

            expect(ajaxSpy).toHaveBeenCalled();
        });

        it('makes an ajax call when invoked with a parameter', function() {
            var ajaxSpy = spyOn(jQuery, 'ajax');

            collection.$$list({
                param1: 'hi'
            });

            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual({param1: 'hi'});
        });

        it('throws an error when called with a parameter with an undefined value', function() {
            expect(function() {
                collection.$$list({
                    param1: undefined
                });
            }).toDxFail('Can not send a request with an undefined parameter (param1 is undefined).');
        });

        it('rejects a call when passed a parameter that isn\'t defined', function() {
            expect(function() {
                collection.$$list({
                    nonParam: 'hi'
                });
            }).toDxFail(new Error('nonParam is not a valid parameter name.'));
        });

        it('rejects a call when passed a parameter that isn\'t the right type', function() {
            expect(function() {
                collection.$$list({
                    param1: 45
                });
            }).toDxFail(new Error('param1 has to be type string but is integer (45)'));
        });

        it('rejects a call when a required parameter is not provided', function() {
            collection = new target._collectionConstructors.RequiredParams();

            expect(function() {
                collection.$$list({
                    notRequired: 'optional!'
                });
            }).toDxFail(new Error('required is required, but has not been passed.'));
        });

        it('does not reject a call when a non-required parameter is not passed', function() {
            var ajaxSpy = spyOn(jQuery, 'ajax');
            collection = new target._collectionConstructors.RequiredParams();

            collection.$$list({
                required: 'MUST have'
            });

            expect(ajaxSpy).toHaveBeenCalled();
        });

        it('validates all parameter types', function() {
            var ajaxSpy = spyOn(jQuery, 'ajax');
            var newDate = new Date();
            newDate.setUTCFullYear(2013, 11, 11);
            newDate.setUTCHours(10, 9, 8, 765);

            collection.$$list({
                nullParam: null,
                stringParam: 'hi',
                intParam: 34,
                numberParam: 3.4,
                booleanParam: true,
                arrayParam: [],
                objectParam: {},
                dateParam: newDate
            });

            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                { nullParam: null, stringParam : 'hi', intParam : 34, numberParam : 3.4, booleanParam : true,
                arrayParam : [  ], objectParam : {  }, dateParam: '2013-12-11T10:09:08.765Z' });
        });

        it('adds returned models to the collection', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                            type: 'hasList',
                            reference: 'WHEE-1'
                        }, {
                            type: 'hasList',
                            reference: 'WHEE-2'
                        } ]
                });
            });

            collection.$$list();

            expect(collection.length).toBe(2);
        });

        it('adds returned models to the collection, even if they are not cacheable', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                            type: 'NoParams'
                        } ]
                });
            });

            collection = new target._newServerCollection('NoParams');
            collection.$$list();

            expect(collection.length).toBe(1);
        });

        it('updates whole collection on list, removing old and adding new', function() {
            var ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                            type: 'hasList',
                            reference: 'WHEE-1'
                        }, {
                            type: 'hasList',
                            reference: 'WHEE-2'
                        } ]
                });
            });
            collection.$$list();
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                            type: 'hasList',
                            reference: 'WHEE-2'
                        }, {
                            type: 'hasList',
                            reference: 'WHEE-3'
                        } ]
                });
            });

            collection.$$list();

            expect(collection.length).toBe(2);
            expect(collection.at(0).get('reference')).toBe('WHEE-2');
            expect(collection.at(1).get('reference')).toBe('WHEE-3');
        });

        it('marks models as being ready', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                            type: 'hasList',
                            reference: 'WHEE-1'
                        }, {
                            type: 'hasList',
                            reference: 'WHEE-2'
                        } ]
                });
            });

            collection.$$list();

            expect(collection.at(0)._dxIsReady).toBe(true);
        });

        it('will call the success handler after doing a successful $$list()', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [
                    ]
                });
            });
            var successSpy = jasmine.createSpy('successSpy');
            var queryParams = {
                param1: 'hi'
            };

            collection.$$list(queryParams, {
                success: successSpy
            });

            expect(successSpy).toHaveBeenCalled();
        });

        it('will call the error handler after doing a failing $$list()', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    type: 'ErrorResult'
                });
            });
            var errorSpy = jasmine.createSpy('errorSpy');
            var queryParams = {
                param1: 'hi'
            };

            collection.$$list(queryParams, {
                error: errorSpy
            });

            expect(errorSpy).toHaveBeenCalled();
        });

        it('will handle a case where a schema\'s list returns other than the type of the collection type', function() {
            var listType = {
                name: 'ChildTypeWithList',
                root: '/somewhere',
                'extends': {
                    $ref: 'p'
                },
                list: {
                    'return': {
                        type: 'array',
                        items: {
                            type: 'object',
                            $ref: 'p'
                        }
                    }
                }
            };

            var parent = {
                name: 'ParentType',
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            };

            var otherChild = {
                name: 'OtherChild',
                'extends': {
                    $ref: 'p'
                },
                properties: {
                    reference: {
                        type: 'string'
                    }
                }

            };
            var schemas = schema.prepareSchemas({
                l: listType,
                p: parent,
                c: otherChild
            });
            initCache(target);
            initFilters(target);
            target._filters.ParentType = function(collection, model, handler) {
                handler(dx.core.data._filters.INCLUDE);
            };
            generateModelConstructors(schemas, target);
            generateCollectionConstructors(schemas, target);
            collection = new target._newServerCollection('ChildTypeWithList');

            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                            type: 'OtherChild',
                            reference: 'FISH'
                        }, {
                            type: 'ParentType'
                        }, {
                            type: 'ChildTypeWithList'
                        } ]
                });
            });

            collection.$$list();

            expect(collection.length).toBe(3);
        });

        describe('handling objects with no reference property', function() {
            beforeEach(function() {
                var listType = {
                    name: 'NoRefProperty',
                    root: '/somewhere',
                    properties: {
                        type: { type: 'string' },
                        value: { type: 'number' }
                    },
                    list: {
                        'return': {
                            type: 'array',
                            items: {
                                type: 'object',
                                $ref: 'l'
                            }
                        }
                    }
                };

                var schemas = schema.prepareSchemas({
                    l: listType
                });
                initCache(target);
                initFilters(target);
                target._filters.NoRefProperty = function(collection, model, handler) {
                    handler(dx.core.data._filters.INCLUDE);
                };
                generateModelConstructors(schemas, target);
                generateCollectionConstructors(schemas, target);
                collection = new target._newServerCollection('NoRefProperty');

                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'ListResult',
                        result: [{
                            type: 'NoRefProperty',
                            value: 1
                        }, {
                            type: 'NoRefProperty',
                            value: 2
                        }, {
                            type: 'NoRefProperty',
                            value: 3
                        }]
                    });
                });
            });

            it('will replace contents of collection', function() {
                collection.$$list();
                expect(collection.length).toBe(3);

                // do a second list, as this will reveal whether the collection's contents are replaced
                collection.$$list();

                expect(collection.length).toBe(3);
            });

            it('will not trigger remove events', function() {
                var removeSpy = jasmine.createSpy('removeSpy');
                collection.on('remove', removeSpy);
                collection.$$list();
                expect(collection.length).toBe(3);

                // do a second list, as this will reveal whether the what events are triggered
                collection.$$list();

                expect(removeSpy).not.toHaveBeenCalled();
            });

            it('will trigger a reset event', function() {
                var resetSpy = jasmine.createSpy('resetSpy');
                collection.on('reset', resetSpy);
                collection.$$list();
                expect(collection.length).toBe(3);

                // do a second list, as this will reveal whether the what events are triggered
                collection.$$list();

                expect(resetSpy).toHaveBeenCalled();
            });
        });

        describe('filter function', function() {
            var ajaxSpy;
            beforeEach(function() {
                ajaxSpy = spyOn(jQuery, 'ajax');
                ajaxSpy.andCallFake(RETURN_EMPTY_LISTRESULTS);
                var bogusType = {
                    name: 'BogusType',
                    root: '/somewhere',
                    list: {
                        parameters: {
                            iHaveNoMapsTo: {
                                type: 'string'
                            }
                        },
                        'return': {
                            type: 'string'
                        }
                    }
                };
                var schemas = schema.prepareSchemas({
                    l: bogusType
                });
                initCache(target);
                initFilters(target);
                generateModelConstructors(schemas, target);
                generateCollectionConstructors(schemas, target);
                collection = new target._newServerCollection('BogusType');
            });

            it('will throw an error if there is no filter function for a type when $$list is done', function() {
                expect(function() {
                    collection.$$list();
                }).toDxFail(new Error('No filter function found for collections of type BogusType. Add one to  ' +
                    'dx.core.data._filters. In the mean time, all models will be added to the collection.'));
            });

            it('adds models to the collection, even the filter would otherwise suggest it shouldn\'t be', function() {
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ListResult',
                        result: [{
                            type: 'PagedType',
                            reference: 'PAGED-1'
                        }, {
                            type: 'PagedType',
                            reference: 'PAGED-2'
                        }, {
                            type: 'PagedType',
                            reference: 'PAGED-3'
                        }]
                    });
                });
                var pagedType = {
                    name: 'PagedType',
                    root: '/somewhere',
                    properties: {
                        reference: {
                            type: 'string'
                        },
                        type: {
                            type: 'string'
                        }
                    },
                    list: {
                        parameters: {
                            pageSize: {
                                type: 'integer'
                            }
                        },
                        'return': {
                            type: 'object',
                            $ref: 'p'
                        }
                    }
                };
                var schemas = schema.prepareSchemas({
                    p: pagedType
                });
                initCache(target);
                initFilters(target);
                target._filters.PagedType = function() {
                    return target._filters.UNKNOWN;
                };
                generateModelConstructors(schemas, target);
                generateCollectionConstructors(schemas, target);
                collection = new target._newServerCollection('PagedType');

                collection.$$list({ pageSize: 3 });

                expect(collection.length).toBe(3);
            });
        });

        describe('add events', function() {
            var ajaxSpy;
            var addSpy;

            beforeEach(function() {
                addSpy = jasmine.createSpy('addSpy');
                ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(GENERATE_INITIAL_RESULTS);
            });

            it('does not trigger on the initial list', function() {
                collection.on('add', addSpy);
                collection.$$list();

                expect(addSpy).not.toHaveBeenCalled();
            });

            it('triggers on a partial change', function() {
                collection.$$list();
                collection.on('add', addSpy);
                ajaxSpy.andCallFake(GENERATE_PARTIAL_CHANGE);

                collection.$$list();

                expect(addSpy).toHaveBeenCalled();
            });

            it('does not trigger on a full change', function() {
                collection.$$list();
                collection.on('add', addSpy);
                ajaxSpy.andCallFake(GENERATE_FULL_CHANGE);

                collection.$$list();

                expect(addSpy).not.toHaveBeenCalled();
            });

            it('does not trigger on partial change when _resetOnList is true', function() {
                collection = new target._newServerCollection('hasList', true);

                collection.$$list();
                collection.on('add', addSpy);
                ajaxSpy.andCallFake(GENERATE_PARTIAL_CHANGE);

                collection.$$list();

                expect(addSpy).not.toHaveBeenCalled();
            });
        });

        describe('remove events', function() {
            var ajaxSpy;
            var removeSpy;

            beforeEach(function() {
                removeSpy = jasmine.createSpy('removeSpy');
                ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(GENERATE_INITIAL_RESULTS);
            });

            it('does not trigger on the initial list', function() {
                collection.on('remove', removeSpy);
                collection.$$list();

                expect(removeSpy).not.toHaveBeenCalled();
            });

            it('triggers on a partial change', function() {
                collection.$$list();
                collection.on('remove', removeSpy);
                ajaxSpy.andCallFake(GENERATE_PARTIAL_CHANGE);

                collection.$$list();

                expect(removeSpy).toHaveBeenCalled();
            });

            it('does not trigger on a full change', function() {
                collection.$$list();
                collection.on('remove', removeSpy);
                ajaxSpy.andCallFake(GENERATE_FULL_CHANGE);

                collection.$$list();

                expect(removeSpy).not.toHaveBeenCalled();
            });

            it('does not trigger on partial change when _resetOnList is true', function() {
                collection = new target._newServerCollection('hasList', true);

                collection.$$list();
                collection.on('remove', removeSpy);
                ajaxSpy.andCallFake(GENERATE_PARTIAL_CHANGE);

                collection.$$list();

                expect(removeSpy).not.toHaveBeenCalled();
            });
        });

        describe('reset events', function() {
            var ajaxSpy;
            var resetSpy;

            beforeEach(function() {
                resetSpy = jasmine.createSpy('resetSpy');
                ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(GENERATE_INITIAL_RESULTS);
            });

            it('triggers on the initial list', function() {
                collection.on('reset', resetSpy);
                collection.$$list();

                expect(resetSpy).toHaveBeenCalled();
            });

            it('does not trigger on a partial change', function() {
                collection.$$list();
                collection.on('reset', resetSpy);
                ajaxSpy.andCallFake(GENERATE_PARTIAL_CHANGE);

                collection.$$list();

                expect(resetSpy).not.toHaveBeenCalled();
            });

            it('triggers on a full change', function() {
                collection.$$list();
                collection.on('reset', resetSpy);
                ajaxSpy.andCallFake(GENERATE_FULL_CHANGE);

                collection.$$list();

                expect(resetSpy).toHaveBeenCalled();
            });

            it('triggers when _resetOnList is true, even if partial change', function() {
                collection = new target._newServerCollection('hasList', true);

                collection.$$list();
                collection.on('reset', resetSpy);
                ajaxSpy.andCallFake(GENERATE_PARTIAL_CHANGE);

                collection.$$list();

                expect(resetSpy).toHaveBeenCalled();
            });
        });

        describe('ready events', function() {
            var ajaxSpy;
            var readySpy;

            beforeEach(function() {
                readySpy = jasmine.createSpy('readySpy');
                ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(GENERATE_INITIAL_RESULTS);
            });

            it('triggers on the initial list', function() {
                collection.on('ready', readySpy);
                collection.$$list();

                expect(readySpy).toHaveBeenCalled();
            });

            it('marks all models as ready before invoking first ready handler', function() {
                var otherReadySpy = jasmine.createSpy('readyHandler').andCallFake(function() {
                    expect(collection.at(0)._dxIsReady).toBe(true);
                    expect(collection.at(1)._dxIsReady).toBe(true);
                });
                collection.on('ready', otherReadySpy);

                collection.$$list();

                expect(otherReadySpy).toHaveBeenCalled();
            });

            it('triggers on a partial change', function() {
                collection.$$list();
                collection.on('ready', readySpy);
                ajaxSpy.andCallFake(GENERATE_PARTIAL_CHANGE);

                collection.$$list();

                expect(readySpy).toHaveBeenCalled();
            });

            it('triggers on a full change', function() {
                collection.$$list();
                collection.on('ready', readySpy);
                ajaxSpy.andCallFake(GENERATE_FULL_CHANGE);

                collection.$$list();

                expect(readySpy).toHaveBeenCalled();
            });

            it('waits until the last issued request returns', function() {
                var listResult = {
                    type: 'ListResult',
                    result: [ {
                            type: 'hasList',
                            reference: 'WHEE-1'
                        }]
                };
                var ajaxOptions = [];
                ajaxSpy.andCallFake(function(options) { ajaxOptions.push(options); });
                collection.on('ready', readySpy);

                collection.$$list();
                collection.$$list();

                // Response to first request does not trigger 'ready' event
                ajaxOptions[0].success(listResult);
                expect(readySpy).not.toHaveBeenCalled();
                ajaxOptions[1].success(listResult);
                expect(readySpy).toHaveBeenCalled();
            });

            it('ignores out of order calls when network requests come out of order', function() {
                var listResult = {
                    type: 'ListResult',
                    result: [ {
                            type: 'hasList',
                            reference: 'WHEE-1'
                        }]
                };
                var ajaxOptions = [];
                ajaxSpy.andCallFake(function(options) { ajaxOptions.push(options); });
                collection.on('ready', readySpy);

                collection.$$list();
                collection.$$list();
                collection.$$list();

                // Response to first request does not trigger 'ready' event
                ajaxOptions[0].success(listResult);
                dx.test.assert(readySpy).not.toHaveBeenCalled();
                ajaxOptions[2].success(listResult);
                dx.test.assert(readySpy).toHaveBeenCalled();

                ajaxOptions[1].success(listResult);
                expect(readySpy.callCount).toBe(1);
            });
        });

        it('does not leave any pending error or ready event handlers on success', function() {
            spyOn(jQuery, 'ajax').andCallFake(GENERATE_INITIAL_RESULTS);

            collection.$$list();

            expect(collection._events).toEqual({});
        });

        it('does not trigger an "error" event on success', function() {
            var errorSpy = jasmine.createSpy('readySpy');
            spyOn(jQuery, 'ajax').andCallFake(GENERATE_INITIAL_RESULTS);
            collection.on('error', errorSpy);

            collection.$$list();

            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('reports a status200/ErrorResult as an error with the ErrorResult model', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            collection.$$list(undefined, {
                error: errorSpy
            });

            expect(errorSpy).toHaveBeenCalled();
            expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
        });

        it('waits until the last issued request to trigger "error" for a status200/ErrorResult', function() {
            var errorResult = {
                type: 'ErrorResult'
            };
            var ajaxOptions = [];
            spyOn(jQuery, 'ajax').andCallFake(function(options) { ajaxOptions.push(options); });

            var errorSpy = jasmine.createSpy('errorSpy');
            collection.on('error', errorSpy);

            collection.$$list();
            collection.$$list();

            // Response to first request does not trigger 'error' event
            ajaxOptions[0].success(errorResult);
            expect(errorSpy).not.toHaveBeenCalled();
            ajaxOptions[1].success(errorResult);
            expect(errorSpy).toHaveBeenCalled();
        });

        it('ignores out of order calls when requests come out of order', function() {
            var errorResult = {
                type: 'ErrorResult'
            };
            var ajaxOptions = [];
            spyOn(jQuery, 'ajax').andCallFake(function(options) { ajaxOptions.push(options); });

            var errorSpy = jasmine.createSpy('errorSpy');
            collection.on('error', errorSpy);

            collection.$$list();
            collection.$$list();
            collection.$$list();

            ajaxOptions[0].success(errorResult);
            dx.test.assert(errorSpy).not.toHaveBeenCalled();
            ajaxOptions[2].success(errorResult);
            dx.test.assert(errorSpy).toHaveBeenCalled();

            ajaxOptions[1].success(errorResult);
            expect(errorSpy.callCount).toBe(1);
        });

        it('waits until the last issued request to trigger "error" for a status404/ErrorResult', function() {
            var errorResult = {
                status: 404,
                getResponseHeader: function() {
                    return 'application/json';
                },
                responseText: '{"type":"ErrorResult"}'
            };
            var ajaxOptions = [];
            spyOn(jQuery, 'ajax').andCallFake(function(options) { ajaxOptions.push(options); });

            var errorSpy = jasmine.createSpy('errorSpy');
            collection.on('error', errorSpy);

            collection.$$list();
            collection.$$list();

            ajaxOptions[0].error(errorResult, 'error', 'whatever');
            expect(errorSpy).not.toHaveBeenCalled();
            ajaxOptions[1].error(errorResult, 'error', 'whatever');
            expect(errorSpy).toHaveBeenCalled();
        });

        it('waits until the last issued request to trigger "error" for a status404/ErrorResult', function() {
            var errorResult = {
                status: 404,
                getResponseHeader: function() {
                    return 'application/json';
                },
                responseText: '{"type":"ErrorResult"}'
            };
            var ajaxOptions = [];
            spyOn(jQuery, 'ajax').andCallFake(function(options) { ajaxOptions.push(options); });

            var errorSpy = jasmine.createSpy('errorSpy');
            collection.on('error', errorSpy);

            collection.$$list();
            collection.$$list();
            collection.$$list();

            ajaxOptions[0].error(errorResult, 'error', 'whatever');
            dx.test.assert(errorSpy).not.toHaveBeenCalled();
            ajaxOptions[2].error(errorResult, 'error', 'whatever');
            dx.test.assert(errorSpy).toHaveBeenCalled();

            ajaxOptions[1].error(errorResult, 'error', 'whatever');
            expect(errorSpy.callCount).toBe(1);
        });

        it('triggers an error event when encountering a status200/ErrorResult', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            collection.on('error', errorSpy);
            collection.$$list(undefined, {
                error: function() {}
            });

            expect(errorSpy).toHaveBeenCalled();
        });

        it('triggers an "error" event at any point after the error occurs', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            collection.$$list(undefined, {
                error: function() {}
            });

            collection.on('error', errorSpy);
            expect(errorSpy).toHaveBeenCalled();
        });

        it('reports a status200/ErrorResult with no error handler calls global handler', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            spyOn(target, 'reportErrorResult');

            collection.$$list();

            expect(target.reportErrorResult).toHaveBeenCalled();
        });

        it('triggers an error event when encountering status200/ErrorResult with no error handler', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            collection.on('error', errorSpy);
            collection.$$list();

            expect(errorSpy).toHaveBeenCalled();
        });

        it('reports an status404/ErrorResult as an error with the ErrorResult model', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: '{"type":"ErrorResult"}'
                }, 'error', 'whatever');
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            collection.$$list(undefined, {
                error: errorSpy
            });

            expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
        });

        it('reports a status404/non-ErrorResult as an error with an ErrorResult model', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text';
                    },
                    statusText: 'OOPS',
                    responseText: '<html><body>Bogus, man</body></html>'
                }, 'error', 'whatever');
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            collection.$$list(undefined, {
                error: errorSpy
            });

            expect(errorSpy.mostRecentCall.args[0].get('type')).toBe('ErrorResult');
        });

        it('converts properties of a status404/non-ErrorResult into an ErrorResult', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text';
                    },
                    statusText: 'OOPS',
                    responseText: '<html><body>Bogus, man</body></html>'
                }, 'error', 'whatever');
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            collection.$$list(undefined, {
                error: errorSpy
            });

            expect(errorSpy.mostRecentCall.args[0].get('error').get('details')).toEqual('Communication Error');
            expect(errorSpy.mostRecentCall.args[0].get('error').get('commandOutput'))
                .toEqual('HTTP Error: 404\nStatus text: OOPS\nResponse text: <html><body>Bogus, man</body></html>');
        });

        it('triggers an error event when encountering a status404/ErrorResult', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: '{"type":"ErrorResult"}'
                }, 'error', 'whatever');
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            collection.on('error', errorSpy);
            collection.$$list(undefined, {
                error: function() {}
            });

            expect(errorSpy).toHaveBeenCalled();
        });

        it('triggers an error event when encountering a status404/non-ErrorResult', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text';
                    },
                    statusText: 'OOPS',
                    responseText: '<html><body>Bogus, man</body></html>'
                }, 'error', 'whatever');
            });
            var errorSpy = jasmine.createSpy('errorSpy');

            collection.on('error', errorSpy);
            collection.$$list(undefined, {
                error: function() {}
            });

            expect(errorSpy).toHaveBeenCalled();
        });

        it('it will empty the collection even if the models don\'t have references', function() {
            var noRef = {
                name: 'NoRef',
                root: '/somewhere',
                properties: {
                    type: {
                        type: 'string'
                    }
                },
                list: {
                }
            };
            var target = {};
            var schemas = schema.prepareSchemas({
                p: noRef
            });
            initCache(target);
            initFilters(target);
            target._filters.NoRef = function(collection, model, handler) {
                handler(dx.core.data._filters.INCLUDE);
            };
            generateModelConstructors(schemas, target);
            generateCollectionConstructors(schemas, target);
            collection = new target._newServerCollection('NoRef');
            var ajaxSpy = spyOn(jQuery, 'ajax');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [{
                        type: 'NoRef'
                    }]
                });
            });
            collection.$$list();
            dx.test.assert(collection.length).toBe(1);

            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: []
                });
            });
            collection.$$list();

            expect(collection.length).toBe(0);
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on a successful list when the "ready" event is triggered', function() {
                spyOn(jQuery, 'ajax').andCallFake(function() {
                    collection._dxIsReady = true;
                });

                var promise = collection.$$list();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is resolved with the collection as the value', function() {
                spyOn(jQuery, 'ajax').andCallFake(function() {
                    collection._dxIsReady = true;
                });

                var promise = collection.$$list();
                promise.done(successSpy);

                expect(successSpy).toHaveBeenCalledWith(collection);
            });

            it('is rejected when the $$list triggers an "error" event', function() {
                spyOn(jQuery, 'ajax').andCallFake(function() {
                    collection._dxIsErrored = true;
                });

                var promise = collection.$$list();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('queues promises while multiple requests are outstanding and resolves them all when the last request' +
                    'returns', function() {
                var listResult = {
                    type: 'ListResult',
                    result: [ {
                            type: 'hasList',
                            reference: 'WHEE-1'
                        }]
                };
                var ajaxOptions = [];
                spyOn(jQuery, 'ajax').andCallFake(function(options) { ajaxOptions.push(options); });

                var promiseList = [
                    collection.$$list(),
                    collection.$$list()
                ];
                var callCount = 0;
                function promiseDone() { callCount++; }
                _.each(promiseList, function(p) { p.done(promiseDone); });

                // Response to first request does not trigger 'ready' event
                ajaxOptions[0].success(listResult);
                expect(callCount).toBe(0);
                ajaxOptions[1].success(listResult);
                expect(callCount).toBe(2);
            });
        });
    });

    describe('getQueryParameters', function() {
        beforeEach(function() {
            var listType = {
                name: 'hasList',
                root: '/somewhere',
                list: {
                    parameters: {
                        param1: {
                            type: 'string'
                        }
                    }
                }
            };

            var schemas = schema.prepareSchemas({
                p: listType,
                o: dx.test.dataMocks.okResultSchema,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema
            });
            initCache(target);
            initFilters(target);
            target._filters.hasList = function(collection, model, handler) {
                handler(target._filters.INCLUDE);
            };
            generateModelConstructors(schemas, target);
            generateCollectionConstructors(schemas, target);
            collection = new target._collectionConstructors.hasList();
        });

        it('is empty by default', function() {
            expect(collection.getQueryParameters()).toBeUndefined();
        });

        it('has a copy of the query parameters after doing a successful $$list()', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [
                    ]
                });
            });
            var queryParams = {
                param1: 'hi'
            };

            collection.$$list(queryParams);

            expect(collection.getQueryParameters()).toEqual(queryParams);
            expect(collection.getQueryParameters()).not.toBe(queryParams);
        });

        it('does not have a copy of the query parameters after doing a failed $$list()', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text';
                    },
                    statusText: 'OOPS',
                    responseText: '<html><body>Bogus, man</body></html>'
                }, 'error', 'whatever');
            });
            var queryParams = {
                param1: 'hi'
            };

            collection.$$list(queryParams);

            expect(collection.getQueryParameters()).toBeUndefined();
        });
    });

    describe('clear()', function() {
        beforeEach(function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                        type: 'HasRoot',
                        reference: 'HASROOT-1',
                        name: 'fred'
                    } ]
                });
            });
            target._filters.HasRoot = function(collection, model, handler) {
                handler(target._filters.INCLUDE);
            };
            collection = target._newServerCollection('HasRoot');
            collection.$$list({
                name: 'fred'
            });
        });

        it('will empty the collection', function() {
            expect(collection.length).toBe(1);
            collection.clear();

            expect(collection.length).toBe(0);
        });

        it('will leave the query parameters undefined', function() {
            expect(collection.getQueryParameters()).toEqual({ name: 'fred' });

            collection.clear();

            expect(collection.getQueryParameters()).toBeUndefined();
        });

        it('will trigger reset events', function() {
            var resetSpy = jasmine.createSpy('resetSpy');
            collection.on('reset', resetSpy);

            collection.clear();

            expect(resetSpy).toHaveBeenCalled();
        });

        it('will not allow new models to be added', function() {
            var newModel = target._newClientModel('HasRoot');

            collection.clear();

            collection._dxAddOrRemove(newModel);

            expect(collection.length).toBe(0);
        });
    });

    describe('set()', function() {
        it('will throw an error if called ordinarily', function() {
            expect(function() {
                collection.set([
                    target._newClientModel('HasRoot'),
                    target._newClientModel('ChildOfRoot')
                ]);
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('will not throw an error if called with the special passthrough mode', function() {
            expect(function() {
                collection.set([
                    target._newClientModel('HasRoot'),
                    target._newClientModel('ChildOfRoot')
                ], {
                    _dxAllowSetPassthrough: true
                });
            }).not.toThrow();
        });

        it('will throw an error if given a hash of properties', function() {
            expect(function() {
                collection.set({
                    type: 'HasRoot'
                }, {
                    _dxAllowSetPassthrough: true
                });
            }).toDxFail(new Error('Can not add an arbitrary set of attributes. Must pass a Backbone Model.'));
        });

        it('throw an error if called with an incompatible type', function() {
            var model = new SimpleModelConstructor();
            model.set('type', 'Bogus');

            expect(function() {
                collection.set(model, {
                    _dxAllowSetPassthrough: true
                });
            }).toDxFail(new Error('Can not add a model of type Bogus to a collection with a base type of HasRoot.'));
        });

    });

    describe('_newServerCollection()', function() {
        beforeEach(function() {
            collection = target._newServerCollection('HasRoot');
        });

        it('throws an error if called without a parameter', function() {
            expect(function() {
                collection = target._newServerCollection();
            }).toDxFail(new Error('To create a new collection, a type name must be provided.'));
        });

        it('throws an error if called with an unknonwn type name', function() {
            expect(function() {
                collection = target._newServerCollection('NoRoot');
            }).toDxFail(new Error('NoRoot is not a known type with a list operation. Can not create this collection.'));
        });

        it('throws an error if add is called', function() {
            expect(function() {
                collection.add(target._newClientModel('NoRoot'));
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('throws an error if remove is called', function() {
            expect(function() {
                collection.remove(collection.models);
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('will throw an error if reset is called', function() {
            collection = target._newServerCollection('HasRoot');

            expect(function() {
                collection.reset([
                    target._newClientModel('HasRoot'),
                    target._newClientModel('ChildOfRoot')
                ]);
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('will throw an error if push is called', function() {
            collection = target._newServerCollection('HasRoot');

            expect(function() {
                collection.push([
                    target._newClientModel('HasRoot'),
                    target._newClientModel('ChildOfRoot')
                ]);
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('will throw an error if unshift is called', function() {
            collection = target._newServerCollection('HasRoot');

            expect(function() {
                collection.unshift([
                    target._newClientModel('HasRoot'),
                    target._newClientModel('ChildOfRoot')
                ]);
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('throws an error if reset is called', function() {
            expect(function() {
                collection.reset();
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('throws an error if pop is called', function() {
            expect(function() {
                collection.pop();
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('throws an error if shift is called', function() {
            expect(function() {
                collection.shift();
            }).toDxFail(new Error('Can not call this operation on a Server Collection.'));
        });

        it('throws an error if create is called', function() {
            expect(function() {
                collection.create({ type: 'HasRoot' });
            }).toDxFail(new Error('Do not call create() directly. Instead, call rootOps.HasRoot.$$create().'));
        });

        it('throws an error if fetch is called', function() {
            expect(function() {
                collection.fetch();
            }).toDxFail(new Error('Do not call fetch() directly. Instead, call $$list().'));
        });
    });

    describe('ready event', function() {
        it('is not triggered on a new collection', function() {
            var readySpy = jasmine.createSpy('readySpy');
            collection.on('ready', readySpy);

            expect(readySpy).not.toHaveBeenCalled();
        });

        it('is triggered after a $$list()', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                            type: 'HasRoot',
                            reference: 'SAMPLE-1'
                        }, {
                            type: 'HasRoot',
                            reference: 'SAMPLE-2'
                        } ]
                });
            });
            var readySpy = jasmine.createSpy('readySpy');
            collection.on('ready', readySpy);

            collection.$$list();

            expect(readySpy).toHaveBeenCalled();
        });

        it('is triggered even when assigned after having done a $$list()', function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                            type: 'HasRoot',
                            reference: 'SAMPLE-3'
                        }, {
                            type: 'HasRoot',
                            reference: 'SAMPLE-4'
                        } ]
                });
            });
            var readySpy = jasmine.createSpy('readySpy');
            collection.$$list();

            collection.on('ready', readySpy);

            expect(readySpy).toHaveBeenCalled();
        });

        it('is not triggered while a $$list() is being performed', function() {
            var ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                            type: 'HasRoot',
                            reference: 'SAMPLE-1'
                        }, {
                            type: 'HasRoot',
                            reference: 'SAMPLE-2'
                        } ]
                });
            });
            var readySpy = jasmine.createSpy('readySpy');
            collection.$$list();

            ajaxSpy.andCallFake(function() {
                // return nothing.  Leave the collection 'waiting'
            });

            collection.$$list();
            collection.on('ready', readySpy);

            expect(readySpy).not.toHaveBeenCalled();
        });
    });

    describe('getAutoPageRefresh()', function() {
        it('is false by default', function() {
            expect(collection.getAutoPageRefresh()).toBe(false);
        });

        it('is true after being set by setAutoPageRefresh()', function() {
            collection.setAutoPageRefresh(true);
            expect(collection.getAutoPageRefresh()).toBe(true);
        });
    });

    describe('_dxEmpty()', function() {
        beforeEach(function() {
            spyOn(jQuery, 'ajax').andCallFake(function(options) {
                options.success({
                    type: 'ListResult',
                    result: [ {
                        type: 'HasRoot',
                        reference: 'HASROOT-1',
                        name: 'fred'
                    } ]
                });
            });
            target._filters.HasRoot = function(collection, model, handler) {
                handler(target._filters.INCLUDE);
            };
            collection = target._newServerCollection('HasRoot');
            collection.$$list({
                name: 'fred'
            });
        });

        it('will empty the collection', function() {
            expect(collection.length).toBe(1);
            collection._dxEmpty();

            expect(collection.length).toBe(0);
        });

    });

    describe('_dxAddOrRemove()', function() {
        beforeEach(function() {
            collection = target._newServerCollection('HasRoot');
        });

        it('will throw an error if called with an incompatible model', function() {
            expect(function() {
                collection._dxAddOrRemove(target._newClientModel('NoRoot'));
            }).toDxFail(new Error('Can not add a model of type NoRoot to a collection with a base type of HasRoot.'));
        });

        it('will throw an error if called with no model', function() {
            expect(function() {
                collection._dxAddOrRemove();
            }).toDxFail(new Error('Can not call without a model.'));
        });

        it('will always add a model if there are no query parameters', function() {
            spyOn(jQuery, 'ajax').andCallFake(RETURN_EMPTY_LISTRESULTS);
            collection.$$list();
            collection._dxAddOrRemove(target._newClientModel('HasRoot'));
            expect(collection.length).toBe(1);
        });

        describe('with no query parameters and no filter function', function() {
            var successSpy;

            beforeEach(function() {
                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'ListResult',
                        result: [ {
                            type: 'NoQueryParams',
                            reference: 'REF-1',
                            name: 'fred'
                        } ]
                    });
                });
                collection = target._newServerCollection('NoQueryParams');
                successSpy = jasmine.createSpy('successSpy');
                collection.$$list({}, {
                    success: successSpy
                });
            });

            it('will add the model automatically because there are no query parameters possible', function() {
                collection._dxAddOrRemove(target._newClientModel('NoQueryParams'));

                expect(collection.length).toBe(2);
            });

        });

        describe('with no query parameters and the uber filter function', function() {
            var successSpy;

            beforeEach(function() {
                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'ListResult',
                        result: [ {
                            type: 'WithMapsTo',
                            reference: 'REF-1',
                            name: 'fred'
                        } ]
                    });
                });
                collection = target._newServerCollection('WithMapsTo');
                successSpy = jasmine.createSpy('successSpy');
                collection.$$list({
                    name: 'fred'
                }, {
                    success: successSpy
                });
            });

            it('will add the model automatically because there are no query parameters possible', function() {
                var client = target._newClientModel('WithMapsTo');
                client.set('name', 'fred');
                collection._dxAddOrRemove(client);

                expect(collection.length).toBe(2);
            });

        });

        describe('with query parameters and a filter function', function() {
            var ajaxSpy;
            var successSpy;

            beforeEach(function() {
                ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    options.success({
                        type: 'ListResult',
                        result: [ {
                            type: 'HasRoot',
                            reference: 'HASROOT-1',
                            name: 'fred'
                        } ]
                    });
                });
                successSpy = jasmine.createSpy('successSpy');
                target._filters.HasRoot = function(collection, model, handler) {
                    handler(target._filters.INCLUDE);
                };
                collection.$$list({
                    name: 'fred'
                }, {
                    success: successSpy
                });
            });

            it('will add the model if the filter says INCLUDE', function() {
                collection._dxAddOrRemove(target._newClientModel('HasRoot'));
                expect(collection.length).toBe(2);
            });

            it('will not add the model if it has been deleted', function() {
                var model = target._newClientModel('HasRoot');
                model._dxDeleted = true;
                collection._dxAddOrRemove(model);
                expect(collection.length).toBe(1);
            });

            it('will always add subtypes if filter says INCLUDE', function() {
                collection._dxAddOrRemove(target._newClientModel('ChildOfRoot'));
                expect(collection.length).toBe(2);
            });

            /*
             * This test is a bit subtle.  Ordinarily, the model being added to the collection would be coming from
             * the cache, and so would be the same as the one already in it. In this test, however, we deliberately
             * try to set a different model with the same reference. This validates in part that we aren't triggering
             * the underlying Backbone functionality which would be happy to copy attributes over to the model in
             * the collection (which we emphatically do not want to have happen)
             */
            it('will not affect the collection if the model is already there', function() {
                target._filters.HasRoot = function(collection, model, handler) {
                    handler(target._filters.INCLUDE);
                };

                var model = target._newClientModel('HasRoot');
                model.set('reference', 'HASROOT-1');
                model.set('name', 'newName');

                collection._dxAddOrRemove(model);

                expect(collection.length).toBe(1);
                expect(collection.at(0).get('name')).toBe('fred');
            });

            it('will do nothing if asked to remove a model that isn\'t in the collection', function() {
                target._filters.HasRoot = function(collection, model, handler) {
                    handler(target._filters.EXCLUDE);
                };

                var model = target._newClientModel('HasRoot');
                model.set('reference', 'HASROOT-2');

                collection._dxAddOrRemove(model);

                expect(collection.length).toBe(1);
            });

            it('will remove the model from the collection if it is already there', function() {
                target._filters.HasRoot = function(collection, model, handler) {
                    handler(target._filters.EXCLUDE);
                };

                var model = target._newClientModel('HasRoot');
                model.set('reference', 'HASROOT-1');

                collection._dxAddOrRemove(model);

                expect(collection.length).toBe(0);
            });

            it('will trigger a dirty event in the case this is UNKNOWN', function() {
                target._filters.HasRoot = function(collection, model, handler) {
                    handler(target._filters.UNKNOWN);
                };
                var dirtySpy = jasmine.createSpy('dirtySpy');
                var model = target._newClientModel('HasRoot');
                collection.on('dirty', dirtySpy);

                collection._dxAddOrRemove(model);

                expect(dirtySpy).toHaveBeenCalled();
            });

            it('will trigger a new list call, if autoPageRefresh is true', function() {
                target._filters.HasRoot = function(collection, model, handler) {
                    handler(target._filters.UNKNOWN);
                };
                var model = target._newClientModel('HasRoot');
                collection.setAutoPageRefresh(true);
                expect(successSpy.calls.length).toBe(1);
                jasmine.Clock.useMock();

                collection._dxAddOrRemove(model);

                // keep the list from infinitely calling itself.
                target._filters.HasRoot = function(collection, model, handler) {
                    handler(target._filters.INCLUDE);
                };
                jasmine.Clock.tick(1);

                expect(successSpy.calls.length).toBe(2);
            });

            it('will trigger only one new list call even if autoPageRefresh true and many UNKNOWN models returned',
                function() {
                target._filters.HasRoot = function(collection, model, handler) {
                    handler(target._filters.UNKNOWN);
                };
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ListResult',
                        result: [ {
                            type: 'HasRoot',
                            reference: 'HASROOT-1'
                        }, {
                            type: 'HasRoot',
                            reference: 'HASROOT-2'
                        }, {
                            type: 'HasRoot',
                            reference: 'HASROOT-3'
                        } ]
                    });
                });
                successSpy = jasmine.createSpy('successSpy');
                collection = target._newServerCollection('HasRoot');
                collection.setAutoPageRefresh(true);
                jasmine.Clock.useMock();

                collection.$$list(undefined, {
                    success: successSpy
                });

                jasmine.Clock.tick(1);

                expect(successSpy.calls.length).toBe(1);
            });

            it('will throw an error if the filter returns an unknown value', function() {
                target._filters.HasRoot = function(collection, model, handler) {
                    handler(5);
                };

                expect(function() {
                    collection._dxAddOrRemove(target._newClientModel('HasRoot'));
                }).toDxFail(new Error('Filter returned an invalid value.'));
            });
        });
    });
});
