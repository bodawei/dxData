/*
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*eslint-env jasmine */
/*global dx */

'use strict';

describe('dx.test.mockServer collection filters', function() {

    describe('auto generating filters', function() {
        var collection,
            uberFilter = dx.test.mockServer._filters._uberFilter;

        describe('simple properties', function() {

            describe('query parameter and object property have the same name', function() {
                var schemas;

                beforeEach(function() {
                    var schema = {
                        name: 'TestType',
                        root: '/everythingisawesome',
                        properties: {
                            sameProp: { type: 'string' }
                        },
                        list: {
                            parameters: {
                                sameProp: {
                                    type: 'string',
                                    mapsTo: 'sameProp'
                                }
                            }
                        }
                    };

                    collection = [{
                        sameProp: 'val'
                    }];

                    schemas = dx.core.data._prepareSchemas({s: schema});
                });

                it('fails if no mapsTo property is defined', function() {
                    delete schemas.TestType.list.parameters.sameProp.mapsTo;

                    var qParams = {
                        sameProp: 'val'
                    };

                    expect(function() {
                        uberFilter(collection, qParams, 'TestType', schemas);
                    }).toDxFail('No mapsTo property found for query parameter sameProp.');
                });

                it('includes an object when the values match', function() {
                    var qParams = {
                        sameProp: 'val'
                    };

                    var result = uberFilter(collection, qParams, 'TestType', schemas);

                    expect(result.length).toBe(1);
                });

                it('excludes an object when the values don\'t match', function() {
                   var qParams = {
                        sameProp: 'other'
                    };

                    var result = uberFilter(collection, qParams, 'TestType', schemas);

                    expect(result.length).toBe(0);
                });
            });

            describe('query parameter and object property have different names', function() {
                var schemas;

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

                    collection = [{
                        aProp: 'val'
                    }];

                    schemas = dx.core.data._prepareSchemas({s: schema});
                });

                it('includes an object when the values match', function() {
                    var qParams = {
                        bProp: 'val'
                    };

                    var result = uberFilter(collection, qParams, 'TestType', schemas);

                    expect(result.length).toBe(1);
                });

                it('excludes an object when the values don\'t match', function() {
                    var qParams = {
                        bProp: 'other'
                    };

                    var result = uberFilter(collection, qParams, 'TestType', schemas);

                    expect(result.length).toBe(0);
                });
            });

            describe('query parameter maps to a chian of object references', function() {
                var schemas, mockTestType, mockAnotherType, mockFinalType;

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
                            finalObj: { type: 'string', format: 'objectReference', referenceTo: 'f' }
                        }
                    };
                    var finalType = {
                        name: 'FinalType',
                        root: '/blah',
                        properties: {
                            someProp: { type: 'string' }
                        }
                    };

                    mockTestType = {
                        type: 'TestType',
                        anotherObj: 'AnotherType-1'
                    };
                    mockAnotherType = {
                        type: 'AnotherType',
                        finalObj: 'FinalType-1'
                    };
                    mockFinalType = {
                        type: 'FinalType',
                        someProp: 'val'
                    };

                    collection = [ mockTestType ];

                    schemas = dx.core.data._prepareSchemas({s: schema, a: anotherType, f: finalType});
                });

                it('fails if an object reference in the chain can\'t be resolved', function() {
                    spyOn(dx.test.mockServer, 'getObject').andReturn(undefined);

                    var qParams = {
                        aParam: 'val'
                    };

                    expect(function() {
                        uberFilter(collection, qParams, 'TestType', schemas);
                    }).toDxFail('The AnotherType (AnotherType-1) does not exist in the mock server and is needed to ' +
                        'filter your $$list operation.');

                });

                it('includes an object when the values match', function() {
                    spyOn(dx.test.mockServer, 'getObject').andCallFake(function(ref, type) {
                        if (type === 'AnotherType') {
                            return mockAnotherType;
                        } else { // type === 'FinalType'
                            return mockFinalType;
                        }
                    });

                    var qParams = {
                        aParam: 'val'
                    };

                    var result = uberFilter(collection, qParams, 'TestType', schemas);

                    expect(result.length).toBe(1);
                });

                it('excludes an object when the values don\'t match', function() {
                    spyOn(dx.test.mockServer, 'getObject').andCallFake(function(ref, type) {
                        if (type === 'AnotherType') {
                            return mockAnotherType;
                        } else { // type === 'FinalType'
                            return mockFinalType;
                        }
                    });

                    var qParams = {
                        aParam: 'wrong!'
                    };

                    var result = uberFilter(collection, qParams, 'TestType', schemas);

                    expect(result.length).toBe(0);
                });
            });
        });

        /*
         * Because paging is common to multiple types, we only test it once. Since the routine responsible for paging
         * logic is private to the system, we use Faults to test the logic.
         */
        describe('paging', function() {
            var collection;
            var tempMockServer;
            var context;

            beforeEach(function() {
                var faultSchema = {
                    '/delphix-fault.js': {
                        "root": "/webapi/fault",
                        "name": "Fault",
                        "description": "A representation of a fault, with associated user object.",
                        "extends": {
                            "$ref": "/delphix-persistent-object.json"
                        },
                        "properties": {
                        },
                        "read": {},
                        "list": {
                            "description": "Returns the list of all the faults that match the given criteria.",
                            "parameters": {
                                "pageSize": {
                                    "description": "Limit the number of faults returned.",
                                    "type": "integer",
                                    "default": 25,
                                    "minimum": 0
                                },
                                "pageOffset": {
                                    "description": "Offset within fault list, in units of pageSize chunks.",
                                    "type": "integer"
                                },
                            },
                        }
                    }
                };
                var schemas = _.extend(faultSchema, dx.test.CORE_SCHEMAS);
                context = {};
                tempMockServer = new dx.test.MockServer(schemas);
                tempMockServer.start();
                dx.core.data.setupDataSystem(schemas, context);
            });

            afterEach(function() {
                tempMockServer.stop();
            });
            beforeEach(function() {
                var objects = [];

                for (var i = 0; i < 30; i++) {
                    objects.push({
                        reference: 'FAULT-' + i
                    });
                }
                tempMockServer.createObjects({
                    Fault: objects
                });

                collection = context.getServerCollection('Fault');
            });

            it('includes all if pageSize is 0', function() {
                var qParams = {
                    pageSize: 0,
                    pageOffset: 2
                };

                collection.$$list(qParams);
                tempMockServer.respond();

                expect(collection.length).toBe(30);
            });

            it('includes the most recent 25 when there are no query parameters', function() {
                collection.$$list({});
                tempMockServer.respond();

                expect(collection.length).toBe(25);
                expect(collection.at(0).get('reference')).toBe('FAULT-29');
                expect(collection.at(24).get('reference')).toBe('FAULT-5');
            });

            it('includes a number of results equal to the pageSize', function() {
                var qParams = {
                    pageSize: 5
                };

                collection.$$list(qParams);
                tempMockServer.respond();

                expect(collection.length).toBe(5);
                expect(collection.at(0).get('reference')).toBe('FAULT-29');
                expect(collection.at(4).get('reference')).toBe('FAULT-25');
            });

            it('offsets the result set if pageOffset is provided', function() {
                var qParams = {
                    pageOffset: 1
                };

                collection.$$list(qParams);
                tempMockServer.respond();

                expect(collection.length).toBe(5);
                expect(collection.at(0).get('reference')).toBe('FAULT-4');
                expect(collection.at(4).get('reference')).toBe('FAULT-0');
            });

            it('handles both pageSize and pageOffset', function() {
                var qParams = {
                    pageSize: 5,
                    pageOffset: 2
                };

                collection.$$list(qParams);
                tempMockServer.respond();

                expect(collection.length).toBe(5);
                expect(collection.at(0).get('reference')).toBe('FAULT-19');
                expect(collection.at(4).get('reference')).toBe('FAULT-15');
            });

            it('throws an error if negative pageSize is given', function() {
                var qParams = {
                    pageSize: -5,
                    pageOffset: 2
                };

                expect(function() {
                    collection.$$list(qParams);
                }).toDxFail('pageSize must be a positive integer');
            });

            it('returns pages from the end if pageOffset is negative', function() {
                var qParams = {
                    pageSize: 5,
                    pageOffset: -2
                };

                collection.$$list(qParams);
                tempMockServer.respond();

                expect(collection.length).toBe(5);
                expect(collection.at(0).get('reference')).toBe('FAULT-9');
                expect(collection.at(4).get('reference')).toBe('FAULT-5');
            });

            it('returns an empty list if page range is negative', function() {
                var qParams = {
                    pageSize: 5,
                    pageOffset: -20
                };

                collection.$$list(qParams);
                tempMockServer.respond();

                expect(collection.length).toBe(0);
            });

            it('returns an empty list if the start of the page range is greater than the number of models', function() {
                var qParams = {
                    pageSize: 5,
                    pageOffset: 10
                };

                collection.$$list(qParams);
                tempMockServer.respond();

                expect(collection.length).toBe(0);
            });
        });

        describe('dates', function() {
            var dateObj, collection, schema;

            beforeEach(function() {
                schema = {
                    name: 'TestType',
                    root: '/enemysgate',
                    properties: {
                        updateDate: {
                            type: 'string',
                            format: 'date'
                        }
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

                collection = [{
                    updateDate: dateObj
                }];
            });

            it('throws an error when no "mapsTo" property is found', function() {
                var schemas = dx.core.data._prepareSchemas({s: schema});
                delete schemas.TestType.list.parameters.fromDate.mapsTo;

                var qParams = {
                    fromDate: dateObj
                };

                expect(function() {
                    uberFilter(collection, qParams, 'TestType', schemas);
                }).toDxFail('No mapsTo property found for query parameter fromDate');
            });

            it('throws an error when no "inequalityType" property is found', function() {
                var schemas = dx.core.data._prepareSchemas({s: schema});
                delete schemas.TestType.list.parameters.fromDate.inequalityType;

                var qParams = {
                    fromDate: dateObj
                };

                expect(function() {
                    uberFilter(collection, qParams, 'TestType', schemas);
                }).toDxFail('Date property "fromDate" missing "inequalityType" schema property');
            });

            it('includes an object when it occurs on the fromDate and inequalityType is NON-STRICT', function() {
                var qParams = {
                    fromDate: dateObj
                };
                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(1);
            });

            it('includes an object when it occurs on the toDate and inequalityType is NON-STRICT', function() {
                var qParams = {
                    toDate: dateObj
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(1);

            });

            it('excludes an object when it occurs on the fromDate and inequalityType is STRICT', function() {
                schema.list.parameters.fromDate.inequalityType = dx.core.constants.INEQUALITY_TYPES.STRICT;
                var qParams = {
                    fromDate: dateObj
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(0);
            });

            it('excludes an object when it occurs on the toDate and inequalityType is STRICT', function() {
                schema.list.parameters.toDate.inequalityType = dx.core.constants.INEQUALITY_TYPES.STRICT;
                var qParams = {
                    toDate: dateObj
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(0);
            });

            it('follows "mapsTo" chains to check the correct attribute on the object', function() {
                schema = {
                    name: 'TestType',
                    root: '/enemysgate',
                    properties: {
                        anotherObj: {
                            type: 'string',
                            format: 'objectReference',
                            referenceTo: 'a'
                        }
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
                        finalObj: {
                            type: 'string',
                            format: 'objectReference',
                            referenceTo: 'f'
                        }
                    }
                };
                var finalType = {
                    name: 'FinalType',
                    root: '/blah',
                    properties: {
                        dateProp: { type: 'string', format: 'date' }
                    }
                };

                var mockTestType = {
                    type: 'TestType',
                    anotherObj: 'AnotherType-1'
                };
                var mockAnotherType = {
                    type: 'AnotherType',
                    finalObj: 'FinalType-1'
                };
                var mockFinalType = {
                    type: 'FinalType',
                    dateProp: dateObj
                };

                spyOn(dx.test.mockServer, 'getObject').andCallFake(function(ref, type) {
                    if (type === 'AnotherType') {
                        return mockAnotherType;
                    } else { // type === 'FinalType'
                        return mockFinalType;
                    }
                });

                collection = [mockTestType];

                var qParams = {
                    toDate: new Date(dateObj.getTime() + 1)
                };

                var schemas = dx.core.data._prepareSchemas({s: schema, a: anotherType, f: finalType});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(1);
            });

            it('handles alternate names "startDate" and "endDate"', function() {
                var qParams = {
                    startDate: dateObj,
                    endDate: dateObj
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(1);
            });

            it('handles timestamp string as the property value when querying fromDate', function() {
                var qParams = {
                    fromDate: new Date(dateObj.getTime() - 1)
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(1);
            });

            it('handles timestamp string as the property value when querying toDate', function() {
                var qParams = {
                    toDate: new Date(dateObj.getTime() + 1)
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(1);
            });

            it('includes an object when it occurs between the from and toDate', function() {
                var qParams = {
                    toDate: new Date(dateObj.getTime() + 1),
                    fromDate: new Date(dateObj.getTime() - 1)
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(1);
            });

            it('excludes an object when it occurs before the fromDate', function() {
                var qParams = {
                    fromDate: new Date(dateObj.getTime() + 1)
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(0);
            });

            it('excludes an object when it occurs after the toDate', function() {
                var qParams = {
                    toDate: new Date(dateObj.getTime() - 1)
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(0);
            });

            it('excludes an object when the from and the to date are reversed', function() {
                var qParams = {
                    toDate: new Date(dateObj.getTime() - 1),
                    fromDate: new Date(dateObj.getTime() + 1)
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(0);
            });

            it('excludes an object with no date', function() {
                var collection = [{ /* no date prop */}];

                var qParams = {
                    fromDate: dateObj
                };

                var schemas = dx.core.data._prepareSchemas({s: schema});

                var result = uberFilter(collection, qParams, 'TestType', schemas);

                expect(result.length).toBe(0);
            });
        });
    });
});
