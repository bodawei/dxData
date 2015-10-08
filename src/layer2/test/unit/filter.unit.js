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

'use strict';

var schemaSupport = require('../../../layer1/schema.js');
var initCache = require('../../cache.js');
var FilterUtil = require('../../FilterUtil.js');
var generateModelConstructors = require('../../model.js');
var generateCollectionConstructors = require('../../collection.js');
var CreationListener = require('../../creationListener.js');
var CONSTANT = require('../../../util/constant.js');
var CORE_SCHEMAS = require('../../../layer3/test/shared/coreSchemas.js');

describe('FilterUtil', function() {
    var collection;
    var model;
    var filterResult;
    var filterUtil;

    beforeEach(function() {
        filterUtil = new FilterUtil();
    });
    
    function resultHandler(value) {
        filterResult = value;
    }

    function initDxData(schemas, target) {
        initCache(target);
        generateModelConstructors(schemas, target);
        generateCollectionConstructors(schemas, {}, target);
    }

    describe('construction', function() {
        it('creates a FilterUtil instance', function() {
            expect(new FilterUtil().uberFilter).toBeDefined();
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
            var schemas = schemaSupport.prepareSchemas({s0: s0, s1: s1, s2: s2, s3: s3});

            initDxData(schemas, target);
        });

        it('will always include models for collections with no query parameters', function() {
            var collection = target._newServerCollection('NoParams');
            var model = target._newClientModel('NoParams');

            filterUtil.uberFilter(collection, model, resultHandler);

            expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
        });

        it('will filter a rooted model', function() {
            var collection = target._newServerCollection('RootedType');
            collection._queryParameters = {
                canHandle: 'one'
            };
            var model = target._newClientModel('RootedType');
            model.set('canHandle', 'one');

            filterUtil.uberFilter(collection, model, resultHandler);

            expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
        });

        it('will filter a child of a rooted model', function() {
            var collection = target._newServerCollection('RootedType');
            collection._queryParameters = {
                canHandle: 'one'
            };
            var model = target._newClientModel('ChildType');
            model.set('canHandle', 'one');

            filterUtil.uberFilter(collection, model, resultHandler);

            expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
        });

        it('(whitebox) will throw an error if asked to filter an object that has no root', function() {
            var collection = target._newServerCollection('RootedType');
            var model = target._newClientModel('Rootless');

            expect(function() {
                filterUtil.uberFilter(collection, model, resultHandler);
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
                filterUtil.uberFilter(collection, model, resultHandler);
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
                    schemas = schemaSupport.prepareSchemas({s: schema});
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
                        filterUtil.uberFilter(collection, model, resultHandler);
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

                    filterUtil.uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
                });

                it('excludes an object when the values don\'t match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('someProp', 'val');

                    collection._queryParameters = {
                        someProp: 'other'
                    };

                    filterUtil.uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
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
                    schemas = schemaSupport.prepareSchemas({s: schema});
                });

                it('includes an object when the values match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('aProp', 'val');

                    collection._queryParameters = {
                        bProp: 'val'
                    };

                    filterUtil.uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
                });

                it('excludes an object when the values don\'t match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('aProp', 'val');

                    collection._queryParameters = {
                        bProp: 'other'
                    };

                    filterUtil.uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
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
                    schemas = schemaSupport.prepareSchemas(_.extend({
                        t: schema,
                        a: anotherType,
                        f: finalType
                    }, CORE_SCHEMAS));

                    var mockAnotherType = {
                        type: 'AnotherType',
                        finalObj: 'FinalType-1'
                    };
                    var mockFinalType = {
                        type: 'FinalType',
                        someProp: 'val'
                    };

                    ajaxSpy = spyOn($, 'ajax').andCallFake(function(options) {
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

                    filterUtil.uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
                });

                it('includes an object when the values match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('anotherObj', 'AnotherType-1');

                    collection._queryParameters = {
                        aParam: 'val'
                    };

                    filterUtil.uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
                });

                it('excludes an object when the values don\'t match', function() {
                    initDxData(schemas, target);
                    collection = target._newServerCollection('TestType');
                    model = target._newClientModel('TestType');
                    model.set('anotherObj', 'AnotherType-1');

                    collection._queryParameters = {
                        aParam: 'wrong!'
                    };

                    filterUtil.uberFilter(collection, model, resultHandler);

                    expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
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
                var schemas = schemaSupport.prepareSchemas({ s: schema });

                initDxData(schemas, target);

                var notificationListener = new CreationListener({
                    typeName: 'WithPaging',
                    callback: function() {},
                    queryParams: {},
                    context: target,
                    disposeCallback: function() {}
                });
                var model = target._newClientModel('WithPaging');

                filterUtil.uberFilter(notificationListener, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
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
                var schemas = schemaSupport.prepareSchemas({ s: schema });

                initDxData(schemas, target);
                var collection = target._newServerCollection('WithoutPaging');
                var model = target._newClientModel('WithoutPaging');
                model.set('otherParam', 'Some val');

                collection._queryParameters = {
                    otherParam: 'Some val'
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
            });

            it('does not return UNKNOWN if pageSize is 0', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({ s: schema });

                initDxData(schemas, target);
                var collection = target._newServerCollection('WithPaging');
                var model = target._newClientModel('WithPaging');

                collection._queryParameters = {
                    pageSize: 0,
                    pageOffset: 2
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
            });

            it('returns UNKNOWN if pageSize is not 0', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({ s: schema });

                initDxData(schemas, target);
                var collection = target._newServerCollection('WithPaging');
                var model = target._newClientModel('WithPaging');

                collection._queryParameters = {
                    pageSize: 1
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.UNKNOWN);
            });

            it('returns UNKNOWN if pageSize is not defined', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({ s: schema });

                initDxData(schemas, target);
                var collection = target._newServerCollection('WithPaging');
                var model = target._newClientModel('WithPaging');

                collection._queryParameters = {};

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.UNKNOWN);
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
                                inequalityType: CONSTANT.INEQUALITY_TYPES.NON_STRICT
                            },
                            startDate: {
                                type: 'string',
                                format: 'date',
                                mapsTo: 'updateDate',
                                inequalityType: CONSTANT.INEQUALITY_TYPES.NON_STRICT
                            },
                            toDate: {
                                type: 'string',
                                format: 'date',
                                mapsTo: 'updateDate',
                                inequalityType: CONSTANT.INEQUALITY_TYPES.NON_STRICT
                            },
                            endDate: {
                                type: 'string',
                                format: 'date',
                                mapsTo: 'updateDate',
                                inequalityType: CONSTANT.INEQUALITY_TYPES.NON_STRICT
                            }
                        }
                    }
                };

                dateObj = new Date();
            });

            it('throws an error when no "mapsTo" property is found', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});
                delete schemas.TestType.list.parameters.fromDate.mapsTo;

                initDxData(schemas, target);
                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');

                collection._queryParameters = {
                    fromDate: dateObj
                };

                expect(function() {
                    filterUtil.uberFilter(collection, model, resultHandler);
                }).toDxFail('No mapsTo property found for query parameter fromDate.');
            });

            it('throws an error when no "inequalityType" property is found', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});
                delete schemas.TestType.list.parameters.fromDate.inequalityType;

                initDxData(schemas, target);
                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');

                collection._queryParameters = {
                    fromDate: dateObj
                };

                expect(function() {
                    filterUtil.uberFilter(collection, model, resultHandler);
                }).toDxFail('Date property "fromDate" missing "inequalityType" schema property');
            });

            it('includes an object when it occurs on the fromDate and inequalityType is NON-STRICT', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    fromDate: dateObj
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
            });

            it('includes an object when it occurs on the toDate and inequalityType is NON-STRICT', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: dateObj
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
            });

            it('excludes an object when it occurs on the fromDate and inequalityType is STRICT', function() {
                schema.list.parameters.fromDate.inequalityType = CONSTANT.INEQUALITY_TYPES.STRICT;
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    fromDate: dateObj
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
            });

            it('excludes an object when it occurs on the toDate and inequalityType is STRICT', function() {
                schema.list.parameters.toDate.inequalityType = CONSTANT.INEQUALITY_TYPES.STRICT;
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: dateObj
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
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
                                inequalityType: CONSTANT.INEQUALITY_TYPES.STRICT
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

                spyOn($, 'ajax').andCallFake(function(options) {
                    if (options.url === '/somethingclever/AnotherType-1') {
                        options.success(mockAnotherType);
                    } else {
                        options.success(mockFinalType);
                    }
                });

                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema, a: anotherType, f: finalType});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newServerModel('TestType');
                model._dxSet('anotherObj', 'AnotherType-1');

                collection._queryParameters = {
                    toDate: new Date(dateObj.getTime() + 1)
                };

                filterUtil.uberFilter(collection, model, resultHandler);
                model.trigger('ready');

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
            });

            it('handles alternate names "startDate" and "endDate"', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    startDate: dateObj,
                    endDate: dateObj
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
            });

            it('includes an object when it occurs between the from and toDate', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: new Date(dateObj.getTime() + 1),
                    fromDate: new Date(dateObj.getTime() - 1)
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.INCLUDE);
            });

            it('excludes an object when it occurs before the fromDate', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    fromDate: new Date(dateObj.getTime() + 1)
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
            });

            it('excludes an object when it occurs after the toDate', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: new Date(dateObj.getTime() - 1)
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
            });

            it('excludes an object when the from and the to date are reversed', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', dateObj);

                collection._queryParameters = {
                    toDate: new Date(dateObj.getTime() - 1),
                    fromDate: new Date(dateObj.getTime() + 1)
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
            });

            it('excludes an object with no date', function() {
                var target = {};
                var schemas = schemaSupport.prepareSchemas({s: schema});

                initDxData(schemas, target);

                collection = target._newServerCollection('TestType');
                model = target._newClientModel('TestType');
                model.set('updateDate', undefined);

                collection._queryParameters = {
                    fromDate: dateObj
                };

                filterUtil.uberFilter(collection, model, resultHandler);

                expect(filterResult).toBe(CONSTANT.FILTER_RESULT.EXCLUDE);
            });
        });
    });
});
