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
/*global dx, jQuery */

'use strict';

var schema = require('../../../layer1/schema.js');
var initCache = require('../../cache.js');
var initFilters = require('../../filter.js');
var generateModelConstructors = require('../../model.js');
var generateCollectionConstructors = require('../../collection.js');

describe('filters', function() {
    var collection;
    var model;
    var filterResult;

    function resultHandler(value) {
        filterResult = value;
    }

    function initDxData(schemas, target) {
        initCache(target);
        initFilters(target);
        generateModelConstructors(schemas, target);
        generateCollectionConstructors(schemas, target);
    }

    describe('_initFilters', function() {
        it('creates _filters', function() {
            var target = {};
            initFilters(target);

            expect(target._filters).toBeDefined();
        });
    });

    describe('uberFilter()', function() {
        var target;

        beforeEach(function() {
            filterResult = 'unset';
            var s0 = {
                name: 'NoParams',
                root: '/noparams',
                properties: {
                    canHandle: { type: 'string' }
                },
                list: {
                }
            };
            var s1 = {
                name: 'RootedType',
                root: '/everythingisawesome',
                properties: {
                    canHandle: { type: 'string' }
                },
                list: {
                    parameters: {
                        canHandle: {
                            type: 'string',
                            mapsTo: 'canHandle'
                        }
                    }
                }
            };
            var s2 = {
                name: 'ChildType',
                extends: {
                    $ref: 's1'
                }
            };
            var s3 = {
                name: 'Rootless'
            };
            target = {};
            var schemas = schema.prepareSchemas({s0: s0, s1: s1, s2: s2, s3: s3});

            initDxData(schemas, target);
        });

        it('will always include models for collections with no query parameters', function() {
            var collection = target._newServerCollection('NoParams');
            var model = target._newClientModel('NoParams');

            target._filters._uberFilter(collection, model, resultHandler);

            expect(filterResult).toBe(target._filters.INCLUDE);
        });

        it('will filter a rooted model', function() {
            var collection = target._newServerCollection('RootedType');
            collection._queryParameters = {
                canHandle: 'one'
            };
            var model = target._newClientModel('RootedType');
            model.set('canHandle', 'one');

            target._filters._uberFilter(collection, model, resultHandler);

            expect(filterResult).toBe(target._filters.INCLUDE);
        });

        it('will filter a child of a rooted model', function() {
            var collection = target._newServerCollection('RootedType');
            collection._queryParameters = {
                canHandle: 'one'
            };
            var model = target._newClientModel('ChildType');
            model.set('canHandle', 'one');

            target._filters._uberFilter(collection, model, resultHandler);

            expect(filterResult).toBe(target._filters.INCLUDE);
        });

        it('(whitebox) will throw an error if asked to filter an object that has no root', function() {
            var collection = target._newServerCollection('RootedType');
            var model = target._newClientModel('Rootless');

            expect(function() {
                target._filters._uberFilter(collection, model, resultHandler);
            }).toDxFail('Trying to filter a type that has no root type.');
        });

        it('(whitebox) will throw an error if asked to filter an object whose root doesn\'t exist', function() {
            var collection = target._newServerCollection('RootedType');
            collection._queryParameters = {
                canHandle: 'one'
            };
            var model = target._newClientModel('RootedType');
            model.set('canHandle', 'one');
            model._dxSchema.rootTypeName = 'Bogus';

            expect(function() {
                target._filters._uberFilter(collection, model, resultHandler);
            }).toDxFail('Malformed type. Root schema type not found.');
        });

    });

    describe('auto generating filters', function() {

        describe('simple properties', function() {
            var schemas, target;

            describe('query parameter and object property have the same name', function() {
                beforeEach(function() {
                    var schema = {
                        name: 'TestType',
                        root: '/everythingisawesome',
                        properties: {
                            someProp: { type: 'string' }
                        },
                        list: {
                            parameters: {
                                someProp: {
                                    type: 'string',
                                    mapsTo: 'someProp'
                                }
                            }
                        }
                    };

                    target = {};
                    schemas = schema.prepareSchemas({s: schema});
                });

                it('fails if no mapsTo property is defined', function() {
                    delete schemas.TestType.list.parameters.someProp.mapsTo;

                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');

                    collection._queryParameters = {
                        someProp: 'val'
                    };

                    expect(function() {
                        target._filters._uberFilter(collection, model, resultHandler);
                    }).toDxFail('No mapsTo property found for query parameter someProp.');
                });

                it('includes an object when the values match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('someProp', 'val');

                    collection._queryParameters = {
                        someProp: 'val'
                    };

                    target._filters._uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(target._filters.INCLUDE);
                });

                it('excludes an object when the values don\'t match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('someProp', 'val');

                    collection._queryParameters = {
                        someProp: 'other'
                    };

                    target._filters._uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(target._filters.EXCLUDE);
                });
            });

            describe('query parameter and object property have different names', function() {
                var schemas, target;

                beforeEach(function() {
                    var schema = {
                        name: 'TestType',
                        root: '/everythingisawesome',
                        properties: {
                            aProp: { type: 'string' }
                        },
                        list: {
                            parameters: {
                                bProp: {
                                    type: 'string',
                                    mapsTo: 'aProp'
                                }
                            }
                        }
                    };

                    target = {};
                    schemas = schema.prepareSchemas({s: schema});
                });

                it('includes an object when the values match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('aProp', 'val');

                    collection._queryParameters = {
                        bProp: 'val'
                    };

                    target._filters._uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(target._filters.INCLUDE);
                });

                it('excludes an object when the values don\'t match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('aProp', 'val');

                    collection._queryParameters = {
                        bProp: 'other'
                    };

                    target._filters._uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(target._filters.EXCLUDE);
                });
            });

            describe('query parameter maps to a chain of object references', function() {
                var schemas, target, ajaxSpy;

                beforeEach(function() {
                    var schema = {
                        name: 'TestType',
                        root: '/enemysgate',
                        properties: {
                            anotherObj: { type: 'string', format: 'objectReference', referenceTo: 'a' }
                        },
                        list: {
                            parameters: {
                                aParam: {
                                    type: 'string',
                                    mapsTo: 'anotherObj.finalObj.someProp'
                                }
                            }
                        }
                    };
                    var anotherType = {
                        name: 'AnotherType',
                        root: '/somethingclever',
                        properties: {
                            reference: { type: 'string', format: 'objectReference' },
                            type: { type: 'string', required: true, format: 'type' },
                            finalObj: { type: 'string', format: 'objectReference', referenceTo: 'f' }
                        }
                    };
                    var finalType = {
                        name: 'FinalType',
                        root: '/blah',
                        properties: {
                            reference: { type: 'string', format: 'objectReference' },
                            type: { type: 'string', required: true, format: 'type' },
                            someProp: { type: 'string' }
                        }
                    };

                    target = {};
                    schemas = schema.prepareSchemas({
                        s: schema,
                        a: anotherType,
                        f: finalType,
                        call: dx.test.dataMocks.callResultSchema,
                        api: dx.test.dataMocks.apiErrorSchema,
                        e: dx.test.dataMocks.errorResultSchema
                    });

                    var mockAnotherType = {
                        type: 'AnotherType',
                        finalObj: 'FinalType-1'
                    };
                    var mockFinalType = {
                        type: 'FinalType',
                        someProp: 'val'
                    };

                    ajaxSpy = spyOn(jQuery, 'ajax').andCallFake(function(options) {
                        if (options.url === '/somethingclever/AnotherType-1') {
                            options.success(mockAnotherType);
                        } else {
                            options.success(mockFinalType);
                        }
                    });
                });

                it('excludes a model if an object reference in the chain can\'t be resolved', function() {
                    ajaxSpy.andCallFake(function(options) {
                        options.error({
                            status: 404
                        });
                    });

                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('anotherObj', 'AnotherType-1');

                    collection._queryParameters = {
                        aParam: 'val'
                    };

                    target._filters._uberFilter(collection, model, resultHandler);
                    dx.test.mockServer.respond();

                    expect(filterResult).toBe(target._filters.EXCLUDE);
                });

                it('includes an object when the values match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('anotherObj', 'AnotherType-1');

                    collection._queryParameters = {
                        aParam: 'val'
                    };

                    target._filters._uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(target._filters.INCLUDE);
                });

                it('excludes an object when the values don\'t match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('anotherObj', 'AnotherType-1');

                    collection._queryParameters = {
                        aParam: 'wrong!'
                    };

                    target._filters._uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(target._filters.EXCLUDE);
                });
            });
        });

        describe('paging', function() {
            var schema;

            beforeEach(function() {
                schema = {
                    name: 'WithPaging',
                    root: '/enemysgate',
                    properties: {},
                    list: {
                        parameters: {
                            pageSize: { type: 'integer' },
                            pageOffset: { type: 'integer' }
                        }
                    }
                };
            });

            it('ignores paging for notification listeners', function() {
                var target = {};
                var schemas = schema.prepareSchemas({ s: schema });

                initDxData(schemas, target);

                var notificationListener = new dx.core.data.CreationListener({
                    typeName: 'WithPaging',
                    callback: function() {},
                    queryParams: {},
                    context: target,
                    disposeCallback: function() {}
                });
                var model = target._newClientModel('WithPaging');

                target._filters._uberFilter(notificationListener, model, resultHandler);

                expect(filterResult).toBe(target._filters.INCLUDE);
            });

            it('does not return UNKNOWN if the schema does not have paging-related query parameters', function() {
                schema = {
                    name: 'WithoutPaging',
                    root: '/enemysgate',
                    properties: {
                        otherParam: { type: 'string' }
                    },
                    list: {
                        parameters: {
                            otherParam: {
                                type: 'string',
                                mapsTo: 'otherParam'
                            }
                        }
                    }
                };

                var target = {};
                var schemas = schema.prepareSchemas({ s: schema });

                initDxData(schemas, target);
                var collection = target._newServerCollection('WithoutPaging');
                var model = target._newClientModel('WithoutPaging');
                model.set('otherParam', 'Some val');

                collection._queryParameters = {
                    otherParam: 'Some val'
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.INCLUDE);
            });

            it('does not return UNKNOWN if pageSize is 0', function() {
                var target = {};
                var schemas = schema.prepareSchemas({ s: schema });

                initDxData(schemas, target);
                var collection = target._newServerCollection('WithPaging');
                var model = target._newClientModel('WithPaging');

                collection._queryParameters = {
                    pageSize: 0,
                    pageOffset: 2
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.INCLUDE);
            });

            it('returns UNKNOWN if pageSize is not 0', function() {
                var target = {};
                var schemas = schema.prepareSchemas({ s: schema });

                initDxData(schemas, target);
                var collection = target._newServerCollection('WithPaging');
                var model = target._newClientModel('WithPaging');

                collection._queryParameters = {
                    pageSize: 1
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.UNKNOWN);
            });

            it('returns UNKNOWN if pageSize is not defined', function() {
                var target = {};
                var schemas = schema.prepareSchemas({ s: schema });

                initDxData(schemas, target);
                var collection = target._newServerCollection('WithPaging');
                var model = target._newClientModel('WithPaging');

                collection._queryParameters = {};

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.UNKNOWN);
            });
        });

        describe('dates', function() {
            var dateObj, collection, schema;

            beforeEach(function() {
                schema = {
                    name: 'TestType',
                    root: '/enemysgate',
                    properties: {
                        updateDate: { type: 'string', format: 'date' }
                    },
                    list: {
                        parameters: {
                            fromDate: {
                                type: 'string',
                                format: 'date',
                                mapsTo: 'updateDate',
                                inequalityType: dx.core.constants.INEQUALITY_TYPES.NON_STRICT
                            },
                            startDate: {
                                type: 'string',
                                format: 'date',
                                mapsTo: 'updateDate',
                                inequalityType: dx.core.constants.INEQUALITY_TYPES.NON_STRICT
                            },
                            toDate: {
                                type: 'string',
                                format: 'date',
                                mapsTo: 'updateDate',
                                inequalityType: dx.core.constants.INEQUALITY_TYPES.NON_STRICT
                            },
                            endDate: {
                                type: 'string',
                                format: 'date',
                                mapsTo: 'updateDate',
                                inequalityType: dx.core.constants.INEQUALITY_TYPES.NON_STRICT
                            }
                        }
                    }
                };

                dateObj = new Date();
            });

            it('throws an error when no "mapsTo" property is found', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});
                delete schemas.TestType.list.parameters.fromDate.mapsTo;

                initDxData(schemas, target);
                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');

                collection._queryParameters = {
                    fromDate: dateObj
                };

                expect(function() {
                    target._filters._uberFilter(collection, model, resultHandler);
                }).toDxFail('No mapsTo property found for query parameter fromDate.');
            });

            it('throws an error when no "inequalityType" property is found', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});
                delete schemas.TestType.list.parameters.fromDate.inequalityType;

                initDxData(schemas, target);
                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');

                collection._queryParameters = {
                    fromDate: dateObj
                };

                expect(function() {
                    target._filters._uberFilter(collection, model, resultHandler);
                }).toDxFail('Date property "fromDate" missing "inequalityType" schema property');
            });

            it('includes an object when it occurs on the fromDate and inequalityType is NON-STRICT', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    fromDate: dateObj
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.INCLUDE);
            });

            it('includes an object when it occurs on the toDate and inequalityType is NON-STRICT', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: dateObj
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.INCLUDE);
            });

            it('excludes an object when it occurs on the fromDate and inequalityType is STRICT', function() {
                schema.list.parameters.fromDate.inequalityType = dx.core.constants.INEQUALITY_TYPES.STRICT;
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    fromDate: dateObj
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.EXCLUDE);
            });

            it('excludes an object when it occurs on the toDate and inequalityType is STRICT', function() {
                schema.list.parameters.toDate.inequalityType = dx.core.constants.INEQUALITY_TYPES.STRICT;
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: dateObj
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.EXCLUDE);
            });

            it('follows "mapsTo" chains to check the correct attribute on the object', function() {
                schema = {
                    name: 'TestType',
                    root: '/enemysgate',
                    properties: {
                        anotherObj: { type: 'string', format: 'objectReference', referenceTo: 'a' }
                    },
                    list: {
                        parameters: {
                            toDate: {
                                type: 'string',
                                format: 'date',
                                mapsTo: 'anotherObj.finalObj.dateProp',
                                inequalityType: dx.core.constants.INEQUALITY_TYPES.STRICT
                            }
                        }
                    }
                };
                var anotherType = {
                    name: 'AnotherType',
                    root: '/somethingclever',
                    properties: {
                        reference: { type: 'string', format: 'objectReference' },
                        type: { type: 'string', required: true, format: 'type' },
                        finalObj: { type: 'string', format: 'objectReference', referenceTo: 'f' }
                    }
                };
                var finalType = {
                    name: 'FinalType',
                    root: '/blah',
                    properties: {
                        reference: { type: 'string', format: 'objectReference' },
                        type: { type: 'string', required: true, format: 'type' },
                        dateProp: { type: 'string', format: 'date' }
                    }
                };
                var mockAnotherType = {
                    type: 'AnotherType',
                    finalObj: 'FinalType-1'
                };
                var mockFinalType = {
                    type: 'FinalType',
                    dateProp: dateObj
                };

                spyOn(jQuery, 'ajax').andCallFake(function(options) {
                    if (options.url === '/somethingclever/AnotherType-1') {
                        options.success(mockAnotherType);
                    } else {
                        options.success(mockFinalType);
                    }
                });

                var target = {};
                var schemas = schema.prepareSchemas({s: schema, a: anotherType, f: finalType});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newServerModel('TestType');
                model._dxSet('anotherObj', 'AnotherType-1');

                collection._queryParameters = {
                    toDate: new Date(dateObj.getTime() + 1)
                };

                target._filters._uberFilter(collection, model, resultHandler);
                model.trigger('ready');

                expect(filterResult).toBe(target._filters.INCLUDE);
            });

            it('handles alternate names "startDate" and "endDate"', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    startDate: dateObj,
                    endDate: dateObj
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.INCLUDE);
            });

            it('includes an object when it occurs between the from and toDate', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: new Date(dateObj.getTime() + 1),
                    fromDate: new Date(dateObj.getTime() - 1)
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.INCLUDE);
            });

            it('excludes an object when it occurs before the fromDate', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    fromDate: new Date(dateObj.getTime() + 1)
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.EXCLUDE);
            });

            it('excludes an object when it occurs after the toDate', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: new Date(dateObj.getTime() - 1)
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.EXCLUDE);
            });

            it('excludes an object when the from and the to date are reversed', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: new Date(dateObj.getTime() - 1),
                    fromDate: new Date(dateObj.getTime() + 1)
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.EXCLUDE);
            });

            it('excludes an object with no date', function() {
                var target = {};
                var schemas = schema.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', undefined);

                collection._queryParameters = {
                    fromDate: dateObj
                };

                target._filters._uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(target._filters.EXCLUDE);
            });
        });
    });
});