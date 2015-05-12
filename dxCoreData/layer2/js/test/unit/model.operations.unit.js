/*
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*eslint-env jasmine */
/*global dx, Backbone, jQuery, _, $ */

'use strict';

describe('dx.core.data.generateModelConstructors - operations', function() {
    var target;

    /*
     * Note: This next group of tests exercises a lot of the common code used across most/all operation types. Thus,
     * there are tests for cases here that are not covered again in other kinds of object operations, rootOperations
     * and some standard operations.
     */
    describe('$noPayloadObjectOperation()', function() {
        var ajaxSpy;
        var model;
        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    noPayload: {
                        payload: {}
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType,
                o: dx.test.dataMocks.okResultSchema,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema
            });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$noPayload).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$noPayload).toBeDefined();
        });

        it('can be called with no parameters', function() {
            model.set('reference', 'REF-1');
            model.$noPayload();
            expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/REF-1/noPayload');
            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
        });

        it('can not be called if there is no reference', function() {

            expect(function() {
                model.$noPayload();
            }).toDxFail('$noPayload can not be called without a reference property set.');
        });

        it('reports an error if called with a payload', function() {
            model.set('reference', 'REF-1');
            expect(function() {
                model.$noPayload(target._newClientModel('ChildType'));
            }).toDxFail('$noPayload can not be called with a payload (only a success/error object).');
        });

        it('will call success callback with the successful result', function() {
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            model.$noPayload({
                success: successCallback
            });

            expect(successCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(successCallback.mostRecentCall.args[0].get('type')).toEqual('OKResult');
        });

        it('will not complain if no success callback is provided and the call is successful', function() {
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            expect(function() {
                model.$noPayload({});
            }).not.toThrow();
        });

        it('will call error callback if it receives an ErrorResult', function() {
            var errorCallback = jasmine.createSpy('error');
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult',
                    error: {
                        type: 'APIError'
                    }
                });
            });

            model.$noPayload({
                success: successCallback,
                error: errorCallback
            });

            expect(successCallback).not.toHaveBeenCalled();
            expect(errorCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(errorCallback.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
        });

        it('will call system error handler if no error handler provided and the call creates ErrorResult', function() {
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'ErrorResult'
                });
            });
            spyOn(target, 'reportErrorResult');

            model.$noPayload({});
            expect(target.reportErrorResult).toHaveBeenCalled();
        });

        it('will not call system error handler if no error handler provided but suppressDefaultErrorHandler is true',
            function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult'
                    });
                });
                spyOn(target, 'reportErrorResult');

                model.$noPayload({
                    suppressDefaultErrorHandler: true
                });
                expect(target.reportErrorResult).not.toHaveBeenCalled();
            });

        it('will call error callback with an ErrorResult when it gets an ajax error with ErrorResult', function() {
            var errorCallback = jasmine.createSpy('error');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: '{"type":"ErrorResult"}'
                }, 'error', 'whatever');
            });

            model.$noPayload({
                error: errorCallback
            });

            expect(errorCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(errorCallback.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
        });

        it('throws an error if it gets an error with something claiming to be JSON data but isn\'t', function() {
            var errorCallback = jasmine.createSpy('error');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: 'this is junk, I tell you'
                }, 'error', 'whatever');
            });

            expect(function() {
                model.$noPayload({
                    error: errorCallback
                });
            }).toDxFail('Server response claimed to be application/json, but couldn\'t be parsed as JSON (this ' +
                'is junk, I tell you).');
        });

        it('will call system error handler if no error callback provided and it gets an ajax error', function() {
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'application/json';
                    },
                    responseText: '{"type":"ErrorResult"}'
                }, 'error', 'whatever');
            });
            spyOn(target, 'reportErrorResult');

            model.$noPayload({});
            expect(target.reportErrorResult).toHaveBeenCalled();
        });

        it('will call error callback if it receives an ordinary ajax failure', function() {
            var errorCallback = jasmine.createSpy('error');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text/html';
                    },
                    responseText: '<html></html>'
                }, 'error', 'whatever');
            });

            model.$noPayload({
                error: errorCallback
            });

            expect(errorCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(errorCallback.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
        });

        it('will call system error handler if no error callback is provided when get ajax error', function() {
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.error({
                    status: 404,
                    getResponseHeader: function() {
                        return 'text/html';
                    },
                    responseText: '<html></html>'
                }, 'error', 'whatever');
            });
            spyOn(target, 'reportErrorResult');

            model.$noPayload({});
            expect(target.reportErrorResult).toHaveBeenCalled();
        });

        it('will throw an error if the success handler isn\'t a function', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$noPayload({
                    success: 'Hi there'
                });
            }).toDxFail(new Error('The success handler must be a function, but found a string.'));
        });

        it('will throw an error if the error handler isn\'t a function', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$noPayload({
                    error: 'Hi there'
                });
            }).toDxFail(new Error('The error handler must be a function, but found a string.'));
        });

        it('will trigger a "request" event when it calls the server', function() {
            model.set('reference', 'REF-1');
            var requestSpy = jasmine.createSpy('requestSpy');
            model.on('request', requestSpy);

            model.$noPayload();

            expect(requestSpy).toHaveBeenCalled();
        });

        describe('(operation return values)', function() {
            function prepareForTest(returnType) {
                target = {};
                var schema = {
                    root: '/somewhere',
                    properties: { reference: { type: 'string' } },
                    operations: {
                        noPayload: {
                            payload: {}
                        }
                    }
                };
                var okResult = {
                    name: 'OKResult',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        result: {
                            type: ['object', 'string', 'array']
                        }
                    }
                };
                var dummy1 = {
                    name: 'Dummy1',
                    properties: {
                        type: {
                            type: 'string'
                        }
                    }
                };
                var dummy2 = {
                    name: 'Dummy2',
                    properties: {
                        type: {
                            type: 'string'
                        }
                    }
                };
                var serverModelType = {
                    name: 'ServerModelType',
                    root: '/somehwereElse',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        reference: {
                            type: 'string'
                        }
                    }
                };
                var withObjectsAndArrays = {
                    name: 'WithObjectsAndArrays',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        anObject: {
                            type: 'object'
                        },
                        anArray: {
                            type: 'array'
                        }
                    }
                };

                if (returnType) {
                    schema.operations.noPayload.return = returnType;
                }
                var schemas = dx.core.data._prepareSchemas({
                    t: schema,
                    ok: okResult,
                    d1: dummy1,
                    d2: dummy2,
                    smt: serverModelType,
                    woa: withObjectsAndArrays
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newClientModel('t');
            }

            it('will throw an error if there is no return value', function() {
                prepareForTest({ type: 'string' });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success();
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('Operation returned success, but without a typed object: undefined'));
            });

            it('will throw an error if the result type isn\'t a typed object', function() {
                prepareForTest({ type: 'string' });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({});
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('Operation returned success, but without a typed object: [object Object]'));
            });

            it('will accept a return type which matches the definition for a simple type', function() {
                prepareForTest({ type: 'string' });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: 'hi'
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).not.toThrow();
            });

            it('will accept a return type which matches the definition for an object type', function() {
                prepareForTest({
                    type: 'object',
                    $ref: 'd1'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'Dummy1'
                        }
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).not.toThrow();
            });

            it('will pass the raw json returned to the jsonSuccess handler', function() {
                var returnValue;
                prepareForTest({
                    type: 'object',
                    $ref: 'smt'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'ServerModelType',
                            reference: 'SMT-1'
                        }
                    });
                });

                model.$noPayload({ jsonSuccess: function(result) {
                    returnValue = result;
                }});

                expect(returnValue).toEqual({
                    type: 'OKResult',
                    result: {
                        type: 'ServerModelType',
                        reference: 'SMT-1'
                    }
                });
            });

            it('will convert a return value with a reference property to a server model', function() {
                var returnValue;
                prepareForTest({
                    type: 'object',
                    $ref: 'smt'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'ServerModelType',
                            reference: 'SMT-1'
                        }
                    });
                });

                model.$noPayload({ success: function(result) {
                    returnValue = result;
                }});

                expect(returnValue.get('result').isServerModel()).toBe(true);
            });

            it('will convert a return value with an obj with reference inside an array to a server model', function() {
                var returnValue;
                prepareForTest({
                    type: 'object',
                    $ref: 'woa'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'WithObjectsAndArrays',
                            anArray: [ {
                                type: 'ServerModelType',
                                reference: 'SMT-1'
                            } ]
                        }
                    });
                });

                model.$noPayload({ success: function(result) {
                    returnValue = result;
                }});

                expect(returnValue.get('result').get('anArray')[0].isServerModel()).toBe(true);
            });

            it('will convert a return value with an obj with reference inside an object to a server model', function() {
                var returnValue;
                prepareForTest({
                    type: 'object',
                    $ref: 'woa'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'WithObjectsAndArrays',
                            anObject: {
                                aProp: {
                                    type: 'ServerModelType',
                                    reference: 'SMT-1'
                                }
                            }
                        }
                    });
                });

                model.$noPayload({ success: function(result) {
                    returnValue = result;
                }});

                expect(returnValue.get('result').get('anObject').aProp.isServerModel()).toBe(true);
            });

            it('will throw an error if no return type defined, but it nevertheless returns something', function() {
                prepareForTest(undefined);
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: 'hi'
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('(return value) has a value, but it has no definition.'));
            });

            it('will throw an error if the result type doesn\'t match the return type for the operation', function() {
                prepareForTest({ type: 'string' });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: 45
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('(return value) has to be type string but is integer (45)'));
            });

            it('will throw an error if the result type doesn\'t match the return type for the operation', function() {
                prepareForTest({
                    type: 'object',
                    $ref: 'd1'
                });
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: {
                            type: 'Dummy2'
                        }
                    });
                });

                expect(function() {
                    model.$noPayload();
                }).toDxFail(new Error('(return value) has to be type object/Dummy1 but is object/Dummy2'));
            });
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = model.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = model.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = model.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('$payloadObjectOperation()', function() {
        var ajaxSpy;
        var model;

        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    payload: {
                        payload: {
                            type: 'object',
                            $ref: 'o'
                        }
                    },
                    payloadWithEmbedded: {
                        payload: {
                            type: 'object',
                            $ref: 'C'
                        }
                    },
                    payloadWithCreate: {
                        payload: {
                            type: 'object',
                            $ref: 'o'
                        },
                        validateAs: 'create'
                    },
                    payloadWithUpdate: {
                        payload: {
                            type: 'object',
                            $ref: 'o'
                        },
                        validateAs: 'update'
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var otherType = {
                name: 'OtherType',
                properties: {
                    type: {
                        type: 'string',
                        required: true
                    },
                    value: {
                        type: 'integer',
                        required: true
                    },
                    createValue: {
                        type: 'string',
                        create: 'required'
                    },
                    updateValue: {
                        type: 'string',
                        update: 'required'
                    }
                }
            };
            var container = {
                name: 'ContainerType',
                properties: {
                    type: { type: 'string'},
                    embedded: {
                        type: 'object',
                        $ref: 'o',
                        required: true
                    }
                }
            };
            var yetAnotherType = {
                name: 'YetAnotherType',
                'extends': {
                    $ref: 'o'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, C: container,
                a: yetAnotherType, o: otherType, k: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$payload).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$payload).toBeDefined();
        });

        it('will reject a call when there is no reference set', function() {
            expect(function() {
                model.$payload({
                    type: 'OtherType',
                    value: 1145
                });
            }).toDxFail(new Error('$payload can not be called without a reference property set.'));
        });

        it('will reject a call when the payload is not a backbone object', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$payload({
                    type: 'OtherType',
                    value: 1145
                });
            }).toDxFail(new Error('Must call $payload with a backbone model.'));
        });

        it('will reject a call when the payload is not a compatible type', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$payload(target._newClientModel('OKResult'));
            }).toDxFail(new Error('Must call $payload with an instance of OtherType.'));
        });

        it('will call success callback with the successful result', function() {
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            var payload = target._newClientModel('OtherType');
            payload.set('value', 23);
            model.$payload(payload, {
                success: successCallback
            });

            expect(successCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(successCallback.mostRecentCall.args[0].get('type')).toEqual('OKResult');
        });

        it('will make the appropriate call given its parameters', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('OtherType');
            payload.set('value', 23);
            model.$payload(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].type).toBe('POST');
            expect(jQuery.ajax.mostRecentCall.args[0].url).toContain('somewhere/REF-1/payload');
            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"type":"OtherType","value":23}');
        });

        it('will accept a call with a subtype', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('YetAnotherType');
            payload.set('value', 23);
            model.$payload(payload);

            expect(jQuery.ajax).toHaveBeenCalled();
        });

        it('will reject a call when a required parameter is missing', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('OtherType');
            payload.set('value', undefined);

            expect(function() {
                model.$payload(payload);
            }).toDxFail(new Error('The attribute value is required to be non-null/non-undefined.'));
        });

        it('will reject a call when a required parameter in an embedded type is missing', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('ContainerType');
            payload.get('embedded').set('value', undefined);

            expect(function() {
                model.$payloadWithEmbedded(payload);
            }).toDxFail(new Error('The attribute value is required to be non-null/non-undefined.'));
        });

        it('will reject a call when a parameter marked as create:required is missing', function() {
            model.set('reference', 'REF-1');

            var payload = target._newClientModel('OtherType');
            payload.set('value', 23);

            expect(function() {
                model.$payloadWithCreate(payload);
            }).toDxFail(new Error('The attribute createValue is required to be non-null/non-undefined.'));
        });

        it('will accept a call without a payload when the schema says payload is not required', function() {
            var opt = {
                name: 'WithOptional',
                root: '/someRoot',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    }
                },
                operations: {
                    optionalPayload: {
                        payload: {
                            type: 'object',
                            $ref: 'y',
                            required: false
                        }
                    }
                }
            };
            var yetAnotherType = {
                name: 'YetAnotherType'
            };
            var schemas = dx.core.data._prepareSchemas({o: opt, y: yetAnotherType});
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('WithOptional');
            model.set('reference', 'REF-1');

            model.$optionalPayload();

            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(null);
        });

        it('will accept a call with a payload when the schema says payload is not required', function() {
            var opt = {
                name: 'WithOptional',
                root: '/someRoot',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    }
                },
                operations: {
                    optionalPayload: {
                        payload: {
                            type: 'object',
                            $ref: 'y',
                            required: false
                        }
                    }
                }
            };
            var yetAnotherType = {
                name: 'YetAnotherType',
                properties: {
                    type: {
                        type: 'string',
                        required: true
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({o: opt, y: yetAnotherType});
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('WithOptional');
            model.set('reference', 'REF-1');

            model.$optionalPayload(target._newClientModel('YetAnotherType'));

            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual('{"type":"YetAnotherType"}');
        });

        it('will send payload with ceate:optional parameters', function() {
            var opt = {
                name: 'WithOptional',
                root: '/someRoot',
                properties: {
                    type: {
                        type: 'string'
                    },
                    reference: {
                        type: 'string'
                    }
                },
                operations: {
                    payloadWithCreateOptional: {
                        payload: {
                            type: 'object',
                            $ref: 'y'
                        }
                    }
                }
            };
            var yetAnotherType = {
                name: 'YetAnotherType',
                properties: {
                    type: {
                        type: 'string',
                        required: true
                    },
                    co: {
                        type: 'string',
                        create: 'optional'
                    }
                }
            };

            var schemas = dx.core.data._prepareSchemas({o: opt, y: yetAnotherType});
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('WithOptional');
            model.set('reference', 'REF-1');
            var payload = target._newClientModel('YetAnotherType');
            payload.set('co', 'create:optional');

            model.$payloadWithCreateOptional(payload);

            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual('{"type":"YetAnotherType","co":"create:optional"}');
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var payload = target._newClientModel('OtherType');
                payload.set('value', 23);
                var promise = model.$payload(payload);
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var payload = target._newClientModel('OtherType');
                payload.set('value', 23);
                var promise = model.$payload(payload);
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var payload = target._newClientModel('OtherType');
                payload.set('value', 23);
                var promise = model.$payload(payload);
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('$noParametersObjectOperation()', function() {
        var ajaxSpy;
        var model;

        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    noParameters: {}
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, o: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$noParameters).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$noParameters).toBeDefined();
        });

        it('can be called with no parameters', function() {
            model.set('reference', 'REF-1');
            model.$noParameters();
            expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/REF-1/noParameters');
            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
        });

        it('will throw an error if invoked with no reference', function() {
            expect(function() {
                model.$noParameters();
            }).toDxFail(new Error('$noParameters can not be called without a reference property set.'));
        });

        it('will call success callback with the successful result', function() {
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            model.$noParameters({
                success: successCallback
            });

            expect(successCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(successCallback.mostRecentCall.args[0].get('type')).toEqual('OKResult');
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = model.$noParameters();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = model.$noParameters();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = model.$noParameters();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('$parametersObjectOperation()', function() {
        var ajaxSpy;
        var model;

        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    parameters: {
                        parameters: {
                            a: {
                                type: 'string'
                            },
                            c: {
                                type: 'boolean'
                            }
                        }
                    },
                    sendAllTypes: {
                        parameters: {
                            requiredStringVal : {
                                type: 'string',
                                required: true
                            },
                            nullVal: {
                                type: 'null'
                            },
                            numVal: {
                                type: 'number'
                            },
                            intVal: {
                                type: 'integer'
                            },
                            boolVal: {
                                type: 'boolean'
                            },
                            objRefVal: {
                                type: 'string',
                                format: 'objectReference'
                            },
                            dateVal: {
                                type: 'string',
                                format: 'date'
                            },
                            enumVal: {
                                type: 'string',
                                'enum': ['VALUE1', 'VALUE2', 'VALUE3']
                            }
                        }
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, o: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._initCache(target);
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$parameters).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$parameters).toBeDefined();
        });

        it('will call success callback with the successful result', function() {
            var successCallback = jasmine.createSpy('success');
            model.set('reference', 'REF-1');
            ajaxSpy.andCallFake(function(options) {
                options.success({
                    type: 'OKResult'
                });
            });

            model.$parameters({}, {
                success: successCallback
            });

            expect(successCallback.mostRecentCall.args[0] instanceof Backbone.Model).toBe(true);
            expect(successCallback.mostRecentCall.args[0].get('type')).toEqual('OKResult');
        });

        it('it will pass its parameters to the call to the backend', function() {
            model.set('reference', 'REF-1');

            model.$parameters({ a: 'b', c: true});

            expect(jQuery.ajax.mostRecentCall.args[0].type).toBe('GET');
            expect(jQuery.ajax.mostRecentCall.args[0].url).toContain('somewhere/REF-1/parameters');
            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual({ a: 'b', c: true});
        });

        it('will throw an error if invoked without a reference', function() {
            expect(function() {
                model.$parameters({ a: 'b', c: true});
            }).toDxFail(new Error('$parameters can not be called without a reference property set.'));
        });

        it('will throw an error if passed a value other than an object as its parameters', function() {
            model.set('reference', 'REF-1');
            expect(function() {
                model.$parameters('bogus');
            }).toDxFail(new Error('$parameters must be passed a (possibly empty) hash of parameters.'));
        });

        it('will throw an error if called with an undefined parameter', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$parameters({bogus: true});
            }).toDxFail(new Error('bogus is not a valid parameter name.'));
        });

        it('will throw an error if called with a parameter with an undefined value', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$sendAllTypes({requiredStringVal: undefined});
            }).toDxFail(
                new Error('Can not send a request with an undefined parameter (requiredStringVal is undefined).'));
        });

        it('will have no problems if invoked with no parameters', function() {
            model.set('reference', 'REF-1');

            model.$parameters();

            expect(jQuery.ajax.mostRecentCall.args[0].url).toContain('somewhere/REF-1/parameters');
            expect(jQuery.ajax.mostRecentCall.args[0].data).toBeUndefined();
        });

        it('throws an error if a required parameter is not included', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$sendAllTypes({ boolVal: true });
            }).toDxFail(new Error('requiredStringVal is required, but has not been passed.'));
        });

        it('accepts all param types', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'one',
                    boolVal: false,
                    intVal: 34,
                    numVal: 67.6,
                    nullVal: null,
                    objRefVal: 'HI THERE',
                    dateVal: new Date()
                });
            }).not.toDxFail();
        });

        it('throws an error if a parameter type doesn\'t match the specified type', function() {
            model.set('reference', 'REF-1');

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: true
                });
            }).toDxFail(new Error('requiredStringVal has to be type string but is boolean (true)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    boolVal: 1
                });
            }).toDxFail(new Error('boolVal has to be type boolean but is integer (1)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    numVal: 'hi'
                });
            }).toDxFail(new Error('numVal has to be type number but is string ("hi")'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    numVal: 12
                });
            }).not.toDxFail(new Error('numVal has to be type number but is integer (12)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    intVal: 12.12
                });
            }).toDxFail(new Error('intVal has to be type integer but is number (12.12)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    nullVal: true
                });
            }).toDxFail(new Error('nullVal has to be type null but is boolean (true)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    dateVal: true
                });
            }).toDxFail(new Error('dateVal has to be type date but is boolean (true)'));

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    enumVal: 'INVALID_VALUE'
                });
            }).toDxFail(new Error('enumVal is an enum and has to be one of ["VALUE1","VALUE2","VALUE3"] but is' +
                ' "INVALID_VALUE"'));
        });

        it('accepts both string and date values for a date parameter', function() {
            model.set('reference', 'REF-1');
            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    dateVal: '2014-01-01T12:34:56.000Z'
                });
            }).not.toDxFail();

            expect(function() {
                model.$sendAllTypes({
                    requiredStringVal: 'required',
                    dateVal: new Date()
                });
            }).not.toDxFail();
        });

        it('it will pass a date object as a string', function() {
            model.set('reference', 'REF-1');
            var newDate = new Date();
            newDate.setUTCFullYear(2013, 11, 11);
            newDate.setUTCHours(10, 9, 8, 765);

            model.$sendAllTypes({
                requiredStringVal: 'required',
                dateVal: newDate
            });

            expect(jQuery.ajax.mostRecentCall.args[0].data).
                toEqual({ requiredStringVal: 'required', dateVal: '2013-12-11T10:09:08.765Z'});
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = model.$parameters({});
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = model.$parameters({});
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = model.$parameters({});
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('(sending required parameters)', function() {
        function prepareForTest(schema1, schema2) {
            target = {};
            var testType = {
                name: 'TestType',
                root: '/somewhere',
                properties: {
                    reference: {
                        type: 'string'
                    }
                },
                operations: {
                    doit: {
                        payload: {
                            type: 'object',
                            $ref: 'one'
                        }
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({one: schema1, two: schema2, s: testType});
            dx.core.data._generateModelConstructors(schemas, target);
            return target._newClientModel('TestType');
        }

        it('will report an error if a required parameter is not set', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'string',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired'
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            expect(function() {
                model.$doit(payload);
            }).toDxFail('The attribute first is required to be non-null/non-undefined.');
        });

        it('will report an error if a required parameter in an embedded object is not set', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'string',
                        required: true
                    },
                    embedded: {
                        type: 'object',
                        $ref: 'two',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                    first: {
                        type: 'string',
                        required: true
                    }
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');
            payload.set('first', 'hello');

            expect(function() {
                model.$doit(payload);
            }).toDxFail('The attribute first is required to be non-null/non-undefined.');
        });

        it('will send a null value if the property type is "null"', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'null',
                        required: true
                    },
                    embedded: {
                        type: 'object',
                        $ref: 'two',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                    first: {
                        type: 'null',
                        required: true
                    }
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"first":null,"embedded":{"first":null}}');
        });

        it('will not send non-required properties if they are undefined', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'integer',
                        required: true
                    },
                    second: {
                        type: 'string',
                        required: false
                    },
                    third: {
                        type: 'integer'
                    },
                    embedded: {
                        type: 'object',
                        $ref: 'two',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                    first: {
                        type: 'integer',
                        required: true
                    },
                    second: {
                        type: 'string',
                        required: false
                    },
                    third: {
                        type: 'integer'
                    }
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            payload.set({ first: 1, third: undefined, embedded: { first: 11, third: undefined } });

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"first":1,"embedded":{"first":11}}');
        });

        it('will send required true and false props if they are non-null/non-undefined', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    first: {
                        type: 'integer',
                        required: true
                    },
                    second: {
                        type: 'integer',
                        required: false
                    },
                    third: {
                        type: 'integer'
                    },
                    embedded: {
                        type: 'object',
                        $ref: 'two',
                        required: true
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                    first: {
                        type: 'integer',
                        required: true
                    },
                    second: {
                        type: 'integer',
                        required: false
                    },
                    third: {
                        type: 'integer'
                    }
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            payload.set({
                first: 1,
                second: 2,
                third: 3,
                embedded: {
                    first: 11,
                    second: 12,
                    third:13
                }
            });

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).
                toEqual('{"first":1,"second":2,"third":3,"embedded":{"first":11,"second":12,"third":13}}');
        });

        it('will send non-required properties if they are defined', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    third: {
                        type: 'integer'
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            payload.set({ third: 3 });

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"third":3}');
        });

        it('will not send non-required properties if they are undefined', function() {
            var model = prepareForTest({
                name: 'RequiredParams',
                properties: {
                    third: {
                        type: 'integer'
                    }
                }
            }, {
                name: 'ChildRequired',
                properties: {
                }
            });
            model.set('reference', 'REF-1');
            spyOn(jQuery, 'ajax');

            var payload = target._newClientModel('RequiredParams');

            payload.set({ third: undefined });

            model.$doit(payload);

            expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{}');
        });
    });

    describe('$sub_operations()', function() {
        var ajaxSpy;
        var model;

        beforeEach(function() {
            ajaxSpy = spyOn(jQuery, 'ajax');

            target = {};
            var schema = {
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                operations: {
                    noPayload: {
                        payload: {},
                        childPayload: {
                            payload: {}
                        }
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    result: {
                        type: 'string'
                    },
                    type: {
                        type: 'string'
                    }
                }
            };
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, ok: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._generateModelConstructors(schemas, target);
            model = target._newClientModel('t');
        });

        it('is created when specified in the schema', function() {
            expect(model.$noPayload_childPayload).toBeDefined();
        });

        it('is created on child types', function() {
            var childModel = target._newClientModel('ChildType');

            expect(childModel.$noPayload_childPayload).toBeDefined();
        });

        it('can be called with no parameters', function() {
            model.set('reference', 'REF-1');
            model.$noPayload_childPayload();
            expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/REF-1/noPayload/childPayload');
            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = model.$noPayload_childPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = model.$noPayload_childPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                model.set('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = model.$noPayload_childPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

    describe('$rootOperations()', function() {
        var ajaxSpy;

        beforeEach(function() {
            var schema = {
                name: 'RootType',
                root: '/somewhere',
                properties: { reference: { type: 'string' } },
                rootOperations: {
                    noPayload: {
                        payload: {},
                        childPayload: {
                            payload: {}
                        }
                    }
                }
            };
            var childType = {
                name: 'ChildType',
                'extends': {
                    $ref: 't'
                }
            };
            var okResult = {
                name: 'OKResult',
                properties: {
                    type: {
                        type: 'string'
                    }
                }
            };
            target = {};
            ajaxSpy = spyOn(jQuery, 'ajax');
            var schemas = dx.core.data._prepareSchemas({t: schema, c: childType, ok: okResult,
                call: dx.test.dataMocks.callResultSchema,
                api: dx.test.dataMocks.apiErrorSchema,
                e: dx.test.dataMocks.errorResultSchema });
            dx.core.data._generateModelConstructors(schemas, target);
        });

        it('is created when specified in the schema', function() {
            expect(target.rootOps.RootType.$noPayload).toBeDefined();
        });

        it('is not created for child types', function() {
            expect(target.rootOps.ChildType).not.toBeDefined();
        });

        it('is created on child operations', function() {
            expect(target.rootOps.RootType.$noPayload_childPayload).toBeDefined();
        });

        it('can be called with no parameters', function() {
            target.rootOps.RootType.$noPayload();
            expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/noPayload');
            expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
        });

        describe('on singletons', function() {
            beforeEach(function() {
                var schema = {
                    name: 'ASingleton',
                    singleton: true,
                    root: '/a/singleton/url',
                    properties: { reference: { type: 'string' } },
                    rootOperations: {
                        rootOp: {
                            payload: {}
                        }
                    }
                };
                target = {};
                var schemas = dx.core.data._prepareSchemas({ t: schema });
                dx.core.data._generateModelConstructors(schemas, target);
            });

            it('is not put on rootOps if it is defined on a singleton', function() {
                expect(target.rootOps.ASingleton).not.toBeDefined();
            });

            it('is put on singleton model if it is defined on a singleton schema', function() {
                expect(target._newClientModel('ASingleton').$rootOp).toBeDefined();
            });

            it('can be called with no parameters', function() {
                var model = target._newClientModel('ASingleton');

                model.$rootOp();
                expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/a/singleton/url/rootOp');
            });
        });

        describe('returned Promise', function() {
            var successSpy, errorSpy;

            beforeEach(function() {
                successSpy = jasmine.createSpy('success');
                errorSpy = jasmine.createSpy('error');
            });

            it('is resolved on success', function() {
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                var promise = target.rootOps.RootType.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).toHaveBeenCalled();
                expect(errorSpy).not.toHaveBeenCalled();
            });

            it('is rejected on ErrorResult', function() {
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult',
                        error: {
                            type: 'APIError'
                        }
                    });
                });

                var promise = target.rootOps.RootType.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });

            it('is rejected on ajax error', function() {
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                var promise = target.rootOps.RootType.$noPayload();
                promise.done(successSpy).fail(errorSpy);

                expect(successSpy).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalled();
            });
        });
    });

});
