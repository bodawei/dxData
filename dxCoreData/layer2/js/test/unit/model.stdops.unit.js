/*
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*eslint-env jasmine */
/*global dx, Backbone, jQuery, _, $ */

'use strict';

describe('dx.core.data.generateModelConstructors - operations', function() {
    var target;

    describe('standard operations', function() {
        describe('$$delete()', function() {
            var ajaxSpy;
            var model;

            beforeEach(function() {
                var schema = {
                    name: 'HasDelete',
                    root: '/somewhere',
                    properties: {reference: {type: 'string'}},
                    'delete': {
                        payload: {
                            type: 'object',
                            $ref: 'd'
                        }
                    }
                };
                var childType = {
                    name: 'ChildType',
                    'extends': {
                        $ref: 't'
                    }
                };
                var noPayload = {
                    name: 'HasDeleteNoPayload',
                    root: '/somewhere',
                    properties: {reference: {type: 'string'}},
                    'delete': {}
                };
                var requiredPayload = {
                    name: 'HasDeleteRequiredPayload',
                    root: '/somewhere',
                    properties: {reference: {type: 'string'}},
                    'delete': {
                        payload: {
                            type: 'object',
                            $ref: 'd',
                            required: true
                        }
                    }
                };
                var delParams = {
                    name: 'DeleteParams',
                    properties: {
                        required: {
                            type: 'integer',
                            required: true
                        }
                    }
                };
                var noDelete = {
                    name: 'NoDelete',
                    root: '/somewhere',
                    properties: {reference: {type: 'string'}}
                };
                var okResult = {
                    name: 'OKResult',
                    properties: {
                        type: {
                            type: 'string'
                        }
                    }
                };
                var errorResult = {
                    name: 'ErrorResult',
                    properties: {
                        type: {
                            type: 'string'
                        }
                    }
                };
                target = {};
                ajaxSpy = spyOn(jQuery, 'ajax');
                var schemas = dx.core.data._prepareSchemas({
                    t: schema,
                    c: childType,
                    n: noDelete,
                    no: noPayload,
                    r: requiredPayload,
                    d: delParams,
                    err: errorResult,
                    ok: okResult
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('HasDelete');
            });

            it('is created on server models when specified in the schema', function() {
                expect(model.$$delete).toBeDefined();
            });

            it('is created for child types', function() {
                var childModel = target._newServerModel('ChildType');

                expect(childModel.$$delete).toBeDefined();
            });

            it('is not created  on client models, even when specified in the schema', function() {
                model = target._newClientModel('HasDelete');
                expect(model.$$delete).not.toBeDefined();
            });

            it('is not created on server models, when not specified in the schema', function() {
                model = target._newServerModel('NoDelete');
                expect(model.$$delete).not.toBeDefined();
            });

            it('will throw an error if no reference set', function() {
                model = target._newServerModel('HasDelete');

                expect(function() {
                    model.$$delete();
                }).toDxFail(new Error('$$delete can not be called without a reference property set.'));
            });

            it('passes correct parameters when called', function() {
                model._dxSet('reference', 'REF-1');

                model.$$delete();

                expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere/REF-1');
                expect(ajaxSpy.mostRecentCall.args[0].type).toEqual('DELETE');
                expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(undefined);
            });

            it('passes payload when given one', function() {
                model._dxSet('reference', 'REF-1');
                var params = target._newClientModel('DeleteParams');
                params.set('required', 34);

                model.$$delete(params);

                expect(ajaxSpy.mostRecentCall.args[0].data).toEqual('{"required":34}');
            });

            it('calls error callback on error', function() {
                model._dxSet('reference', 'REF-1');
                var errorSpy = jasmine.createSpy('errorSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult'
                    });
                });

                model.$$delete({error: errorSpy});

                expect(errorSpy).toHaveBeenCalled();
                expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
            });

            it('calls success callback on success, when no payload specified', function() {
                model._dxSet('reference', 'REF-1');
                var successSpy = jasmine.createSpy('successSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                model.$$delete({success: successSpy});

                expect(successSpy).toHaveBeenCalled();
                expect(successSpy.mostRecentCall.args[0].get('type')).toEqual('OKResult');
            });

            it('calls success callback on success, when payload specified', function() {
                model._dxSet('reference', 'REF-1');
                var successSpy = jasmine.createSpy('successSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });
                var params = target._newClientModel('DeleteParams');
                params.set('required', 34);

                model.$$delete(params, {success: successSpy});

                expect(successSpy).toHaveBeenCalled();
                expect(successSpy.mostRecentCall.args[0].get('type')).toEqual('OKResult');
            });

            it('doesn\'t complain if no success handler was specified on success', function() {
                model._dxSet('reference', 'REF-1');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                expect(function() {
                    model.$$delete();
                }).not.toThrow();
            });

            it('throws an error if not called with a payload when one required', function() {
                model = target._newServerModel('HasDeleteRequiredPayload');
                model._dxSet('reference', 'REF-1');

                expect(function() {
                    model.$$delete({
                        success: function() {
                        }
                    });
                }).toDxFail(new Error('Must call $$delete with a payload of type DeleteParams.'));
            });

            it('throws an error if called with a payload when none defined', function() {
                model = target._newServerModel('HasDeleteNoPayload');
                model._dxSet('reference', 'REF-1');
                var params = target._newClientModel('DeleteParams');
                params.set('required', 34);

                expect(function() {
                    model.$$delete(params, {
                        success: function() {
                        }
                    });
                }).toDxFail(new Error('$$delete does not allow a payload.'));
            });

            describe('returned Promise', function() {
                var successSpy, errorSpy;

                beforeEach(function() {
                    successSpy = jasmine.createSpy('success');
                    errorSpy = jasmine.createSpy('error');
                });

                it('is resolved on success', function() {
                    model._dxSet('reference', 'REF-1');
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'OKResult'
                        });
                    });

                    var promise = model.$$delete();
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).toHaveBeenCalled();
                    expect(errorSpy).not.toHaveBeenCalled();
                });

                it('is rejected on error', function() {
                    model._dxSet('reference', 'REF-1');
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'ErrorResult'
                        });
                    });

                    var promise = model.$$delete();
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).not.toHaveBeenCalled();
                    expect(errorSpy).toHaveBeenCalled();
                });
            });
        });

        describe('$$update()', function() {
            var ajaxSpy;
            var model;

            beforeEach(function() {
                var schema = {
                    name: 'RootType',
                    root: '/somewhere',
                    properties: {
                        reference: {
                            type: 'string'
                        },
                        required: {
                            type: 'number',
                            required: true
                        }
                    },
                    update: {
                        payload: {
                            type: 'object',
                            $ref: 't'
                        }
                    }
                };
                var childType = {
                    name: 'ChildType',
                    'extends': {
                        $ref: 't'
                    }
                };
                var updateWithAll = {
                    name: 'UpdateType',
                    root: '/somewhere',
                    properties: {
                        reference: {
                            type: 'string'
                        },
                        requiredTrue: {
                            type: 'string',
                            required: true
                        },
                        requiredFalse: {
                            type: 'string',
                            required: false
                        },
                        updateRequired: {
                            type: 'string',
                            update: 'required'
                        },
                        updateOptional: {
                            type: 'string',
                            update: 'optional'
                        },
                        updateReadonly: {
                            type: 'string',
                            update: 'readonly'
                        },
                        updateUnspecified: {
                            type: 'string'
                        }
                    },
                    update: {
                        payload: {
                            type: 'object',
                            $ref: 'u'
                        }
                    }
                };
                target = {};
                ajaxSpy = spyOn(jQuery, 'ajax');
                var schemas = dx.core.data._prepareSchemas({
                    t: schema,
                    c: childType,
                    api: dx.test.dataMocks.apiErrorSchema,
                    call: dx.test.dataMocks.callResultSchema,
                    ok: dx.test.dataMocks.okResultSchema,
                    e: dx.test.dataMocks.errorResultSchema,
                    u: updateWithAll
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('RootType');
            });

            it('is created when specified in the schema', function() {
                expect(model.$$update).toBeDefined();
            });

            it('is created for child types', function() {
                var childModel = target._newServerModel('ChildType');

                expect(childModel.$$update).toBeDefined();
            });

            it('throws an error if called on an object without a reference', function() {
                expect(function() {
                    model.$$update({
                        required: 45
                    });
                }).toDxFail('$$update can not be called without a reference property set.');
            });

            it('throws an error if called without a parameter', function() {
                model._dxSet('reference', 'REF-1');
                expect(function() {
                    model.$$update();
                }).toDxFail('$$update must be called with a non-empty set of attributes.');
            });

            it('will throw an error if called with an empty attributes hash', function() {
                model._dxSet({
                    reference: 'REF-1'
                });

                expect(function() {
                    model.$$update({});
                }).toDxFail('$$update must be called with a non-empty set of attributes.');
            });

            it('will send all required attrs, but no optional ones if they aren\'t in update() call', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                    reference: 'REF-1',
                    requiredTrue: 'alwaysRequired',
                    requiredFalse: 'notRequired',
                    updateRequired: 'required',
                    updateOptional: 'optional',
                    updateReadonly: 'readonly',
                    updateUnspecified: 'unspecified'
                });
                model.$$update({
                    requiredTrue: 'newRequiredValue'
                });
                expect(ajaxSpy.mostRecentCall.args[0].data).
                    toEqual('{"requiredTrue":"newRequiredValue","updateRequired":"required"}');
            });

            it('will send all optional values passed to update, but not readonly ones', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                    reference: 'REF-1'
                });
                model.$$update({
                    requiredTrue: '1',
                    requiredFalse: '2',
                    updateRequired: '3',
                    updateOptional: '4',
                    updateReadonly: '5',
                    updateUnspecified: '6'
                });
                expect(ajaxSpy.mostRecentCall.args[0].data).
                    toEqual('{"requiredTrue":"1","requiredFalse":"2","updateRequired":"3","updateOptional":"4"}');
            });

            it('will not send non-required values passed to update, but that have not changed', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                    reference: 'REF-1',
                    requiredTrue: '1',
                    requiredFalse: '2',
                    updateRequired: '3',
                    updateOptional: '4',
                    updateReadonly: '5',
                    updateUnspecified: '6'
                });
                model.$$update({
                    requiredTrue: '1',
                    requiredFalse: '2',
                    updateRequired: '3',
                    updateOptional: '4',
                    updateReadonly: '5',
                    updateUnspecified: '6'
                });
                expect(ajaxSpy.mostRecentCall.args[0].data).toEqual('{"requiredTrue":"1","updateRequired":"3"}');
            });

            it('will throw an error if one tries to update a non-nullable optional value with null', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                    reference: 'REF-1',
                    requiredTrue: '1',
                    requiredFalse: '2',
                    updateRequired: '3',
                    updateOptional: '4',
                    updateReadonly: '5',
                    updateUnspecified: '6'
                });
                expect(function() {
                    model.$$update({
                        updateOptional: null
                    });
                }).toDxFail('The attribute updateOptional is required to be non-null/non-undefined.');
            });

            it('will throw an error if required attrs are not set in the model or specified in update', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                    reference: 'REF-1'
                });

                expect(function() {
                    model.$$update({
                        requiredFalse: '2',
                        updateOptional: '4',
                        updateUnspecified: '6'
                    });
                }).toDxFail('The attribute requiredTrue is required to be non-null/non-undefined.');
            });

            it('will send null for a type which can be null when it is set to null', function() {
                var nullType = {
                    name: 'NullableType',
                    root: '/somewhere',
                    properties: {
                        reference: {
                            type: ['string', 'null']
                        },
                        requiredTrue: {
                            type: ['string', 'null'],
                            required: true
                        },
                        requiredFalse: {
                            type: ['string', 'null'],
                            required: false
                        },
                        updateRequired: {
                            type: ['string', 'null'],
                            update: 'required'
                        },
                        updateOptional: {
                            type: ['string', 'null'],
                            update: 'optional'
                        }
                    },
                    update: {
                        payload: {
                            type: 'object',
                            $ref: 'u'
                        }
                    }
                };
                target = {};
                var schemas = dx.core.data._prepareSchemas({u: nullType});
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('NullableType');
                model._dxSet({
                    reference: 'REF-1',
                    requiredFalse: 'tempValue',
                    updateOptional: 'tempValue1'
                });

                model.$$update({
                    requiredFalse: null,
                    updateOptional: null
                });

                expect(ajaxSpy.mostRecentCall.args[0].data).
                    toEqual('{"requiredTrue":null,"requiredFalse":null,"updateRequired":null,"updateOptional":null}');
            });

            it('will not send null for a type which can be null but isn\'t', function() {
                var nullType = {
                    name: 'NullableType',
                    root: '/somewhere',
                    properties: {
                        reference: {
                            type: ['string', 'null']
                        },
                        other: {    // just need one type to update
                            type: 'string',
                            required: true
                        },
                        requiredTrue: {
                            type: ['string', 'null'],
                            required: true
                        },
                        requiredFalse: {
                            type: ['string', 'null'],
                            required: false
                        },
                        updateRequired: {
                            type: ['string', 'null'],
                            update: 'required'
                        },
                        updateOptional: {
                            type: ['string', 'null'],
                            update: 'optional'
                        }
                    },
                    update: {
                        payload: {
                            type: 'object',
                            $ref: 'u'
                        }
                    }
                };
                target = {};
                var schemas = dx.core.data._prepareSchemas({u: nullType});
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
                model = target._newServerModel('NullableType');
                model._dxSet({
                    reference: 'REF-1',
                    requiredTrue: 'value1',
                    requiredFalse: 'value2',
                    updateRequired: 'value3',
                    updateOptional: 'value4'
                });

                model.$$update({
                    other: 'placeholder'
                });

                expect(ajaxSpy.mostRecentCall.args[0].data).
                    toEqual('{"other":"placeholder","requiredTrue":"value1","updateRequired":"value3"}');
            });

            it('will accept "" as a return value', function() {
                model = target._newServerModel('UpdateType');
                model._dxSet({
                    reference: 'REF-1'
                });
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult',
                        result: ''
                    });
                });

                expect(function() {
                    model.$$update({
                        requiredTrue: 'alwaysRequired',
                        updateRequired: 'required'
                    });
                }).not.toThrow();
            });

            describe('updating embedded objects', function() {
                beforeEach(function() {
                    var root = {
                        name: 'RootType',
                        root: '/somewhere',
                        properties: {
                            reference: {
                                type: 'string'
                            },
                            type: {
                                type: 'string'
                            },
                            other: {
                                type: 'string'
                            },
                            requiredTrue: {
                                type: ['string', 'null'],
                                required: true
                            },
                            requiredFalse: {
                                type: ['string', 'null'],
                                required: false
                            },
                            updateRequired: {
                                type: ['string', 'null'],
                                update: 'required'
                            },
                            updateOptional: {
                                type: ['string', 'null'],
                                update: 'optional'
                            },
                            embedded: {
                                type: 'object',
                                $ref: 'c',
                                update: 'optional'
                            }
                        },
                        update: {
                            payload: {
                                type: 'object',
                                $ref: 'p'
                            }
                        }
                    };
                    var embedded = {
                        name: 'EmbeddedType',
                        properties: {
                            type: {
                                type: 'string',
                                required: true
                            },
                            embRequiredTrue: {
                                type: ['string', 'null'],
                                required: true
                            },
                            embRequiredFalse: {
                                type: ['string', 'null'],
                                required: false
                            },
                            embUpdateRequired: {
                                type: ['string', 'null'],
                                update: 'required'
                            },
                            embUpdateOptional: {
                                type: ['string', 'null'],
                                update: 'optional'
                            },
                            subEmbedded: {
                                type: 'object',
                                $ref: 'g',
                                update: 'optional'
                            }
                        }
                    };
                    var extendedEmbedded = {
                        name: 'ExtendedEmbeddedType',
                        'extends': {
                            $ref: 'c'
                        },
                        properties: {
                            nameForTesting: {
                                type: 'string',
                                required: true
                            }
                        }
                    };
                    var subembedded = {
                        name: 'SubEmbedded',
                        properties: {
                            type: {
                                type: 'string'
                            },
                            subRequiredTrue: {
                                type: ['string', 'null'],
                                required: true
                            },
                            subRequiredFalse: {
                                type: ['string', 'null'],
                                required: false
                            },
                            subUpdateRequired: {
                                type: ['string', 'null'],
                                update: 'required'
                            },
                            subUpdateOptional: {
                                type: ['string', 'null'],
                                update: 'optional'
                            }
                        }
                    };
                    target = {};
                    var schemas = dx.core.data._prepareSchemas({
                        p: root,
                        c: embedded,
                        g: subembedded,
                        x: extendedEmbedded,
                        api: dx.test.dataMocks.apiErrorSchema,
                        call: dx.test.dataMocks.callResultSchema,
                        ok: dx.test.dataMocks.okResultSchema,
                        e: dx.test.dataMocks.errorResultSchema
                    });
                    dx.core.data._generateModelConstructors(schemas, target);
                });

                it('won\'t send them when they have no new data, even when they have required values', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        requiredTrue: 'required',
                        updateRequired: 'updateRequired',
                        embedded: {
                            embRequiredTrue: 'required',
                            embUpdateRequired: 'updateRequired'
                        }
                    });

                    model.$$update({
                        requiredTrue: 'someValue'
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).
                        toEqual('{"requiredTrue":"someValue","updateRequired":"updateRequired"}');
                });

                it('won\'t send optional sub-embedded when they have no new data, even when they have required values',
                    function() {
                        model = target._newServerModel('RootType');
                        model._dxSet({
                            reference: 'REF-1',
                            requiredTrue: 'r',
                            updateRequired: 'r',
                            embedded: {
                                embRequiredTrue: 'er',
                                embUpdateRequired: 'er'
                            }
                        });

                        model.$$update({
                            embedded: {
                                embRequiredTrue: 'required'
                            }
                        });

                        expect(ajaxSpy.mostRecentCall.args[0].data).
                            toEqual('{"requiredTrue":"r","updateRequired":"r","embedded":{"type":"EmbeddedType",' +
                            '"embRequiredTrue":"required","embUpdateRequired":"er"}}');
                    });

                it('will send them when they have data that should be sent', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1'
                    });

                    model.$$update({
                        embedded: {
                            type: 'EmbeddedType',
                            subEmbedded: {
                                subRequiredTrue: 'sr',
                                subUpdateRequired: 'sr'
                            }
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":null,"embUpdateRequired":null,"subEmbedded":{"subRequiredTrue":"sr",' +
                        '"subUpdateRequired":"sr"}}}');
                });

                it('will send an embedded optional value', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: 'fred'
                            }
                        }
                    });

                    model.$$update({
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: 'new'
                            }
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":null,"embUpdateRequired":null,"subEmbedded":{"subRequiredTrue":null,' +
                        '"subUpdateRequired":null,"subUpdateOptional":"new"}}}');
                });

                it('will send an embedded value which is set to undefined', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: 'fred'
                            }
                        }
                    });

                    model.$$update({
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: undefined
                            }
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":null,"embUpdateRequired":null,"subEmbedded":{"subRequiredTrue":null,' +
                        '"subUpdateRequired":null,"subUpdateOptional":null}}}');
                });

                it('will not send an embedded optional value that hasn\'t changed', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            subEmbedded: {
                                subUpdateOptional: 'fred'
                            }
                        }
                    });

                    model.$$update({
                        embedded: {
                            subEmbedded: {
                                subUpdateRequired: 'new'
                            }
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":null,"embUpdateRequired":null,"subEmbedded":{"subRequiredTrue":null,' +
                        '"subUpdateRequired":"new"}}}');
                });

                it('sends an update that changes the type of an embedded object to a subtype', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            embRequiredTrue: 'yep'
                        }
                    });

                    model.$$update({
                        embedded: {
                            type: 'ExtendedEmbeddedType',
                            nameForTesting: 'testName'
                        }
                    });

                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"nameForTesting":"testName",' +
                        '"type":"ExtendedEmbeddedType","embRequiredTrue":null,"embRequiredFalse":null,' +
                        '"embUpdateRequired":null,"embUpdateOptional":null,"subEmbedded":{"subRequiredTrue":null,' +
                        '"subRequiredFalse":null,"subUpdateRequired":null,"subUpdateOptional":null}}}');
                });

                it('sends an update that changes the type of an embedded object to a super type', function() {
                    model = target._newServerModel('RootType');
                    model._dxSet({
                        reference: 'REF-1',
                        embedded: {
                            type: 'ExtendedEmbeddedType',
                            nameForTesting: 'testName',
                            embUpdateRequired: 'I should not carry over'
                        }
                    });

                    model.$$update({
                        embedded: {
                            type: 'EmbeddedType',
                            embRequiredTrue: 'valueIncluded'
                        }
                    });

                    // To be clear, changing the type means sending all subproperties
                    expect(ajaxSpy.mostRecentCall.args[0].data).toEqual(
                        '{"requiredTrue":null,"updateRequired":null,"embedded":{"type":"EmbeddedType",' +
                        '"embRequiredTrue":"valueIncluded","embRequiredFalse":null,"embUpdateRequired":null,' +
                        '"embUpdateOptional":null,"subEmbedded":{"subRequiredTrue":null,"subRequiredFalse":null,' +
                        '"subUpdateRequired":null,"subUpdateOptional":null}}}');
                });

                it('throws an error when asked to do an update that changes the type to an incompatible type',
                    function() {
                        model = target._newServerModel('RootType');
                        model._dxSet({
                            reference: 'REF-1',
                            embedded: {
                                type: 'ExtendedEmbeddedType',
                                nameForTesting: 'testName'
                            }
                        });

                        expect(function() {
                            model.$$update({
                                embedded: {
                                    type: 'RootType',
                                    reference: 'bogus'
                                }
                            });
                        }).toDxFail('embedded has to be type object/EmbeddedType but is object/RootType');

                    });

            });

            it('calls success callback on success', function() {
                model._dxSet('reference', 'REF-1');
                var successSpy = jasmine.createSpy('successSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                model.$$update({
                    required: 34
                }, {success: successSpy});

                expect(successSpy).toHaveBeenCalled();
                expect(successSpy.mostRecentCall.args[0].get('type')).toEqual('OKResult');
            });

            it('calls error callback on error', function() {
                model._dxSet('reference', 'REF-1');
                var errorSpy = jasmine.createSpy('errorSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'ErrorResult'
                    });
                });

                model.$$update({
                    required: 34
                }, {error: errorSpy});

                expect(errorSpy).toHaveBeenCalled();
                expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
            });

            describe('returned Promise', function() {
                var successSpy, errorSpy;

                beforeEach(function() {
                    successSpy = jasmine.createSpy('success');
                    errorSpy = jasmine.createSpy('error');
                });

                it('is resolved on success', function() {
                    model._dxSet('reference', 'REF-1');
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'OKResult'
                        });
                    });

                    var promise = model.$$update({
                        required: 34
                    });
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).toHaveBeenCalled();
                    expect(errorSpy).not.toHaveBeenCalled();
                });

                it('is rejected on error', function() {
                    model._dxSet('reference', 'REF-1');
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'ErrorResult'
                        });
                    });

                    var promise = model.$$update({
                        required: 34
                    });
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).not.toHaveBeenCalled();
                    expect(errorSpy).toHaveBeenCalled();
                });
            });
        });

        describe('$$create()', function() {
            var ajaxSpy;

            function prepareForTest(paramType, secondParamType) {
                var schema = {
                    name: 'RootType',
                    root: '/somewhere',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        reference: {type: 'string'}
                    },
                    create: {
                        payload: {
                            type: 'object',
                            $ref: 't'
                        }
                    }
                };
                var weirdSchema = {
                    name: 'WeirdCreate',
                    root: '/somewhere',
                    properties: {
                        type: {
                            type: 'string'
                        },
                        reference: {
                            type: 'string'
                        }
                    },
                    create: {
                        payload: {
                            type: 'object',
                            $ref: 't'
                        }
                    }
                };
                var childType = {
                    name: 'ChildType',
                    'extends': {
                        $ref: 't'
                    }
                };
                target = {};
                ajaxSpy = spyOn(jQuery, 'ajax');
                var schemas = dx.core.data._prepareSchemas({
                    t: paramType,
                    two: secondParamType,
                    r: schema,
                    c: childType,
                    o: dx.test.dataMocks.okResultSchema,
                    call: dx.test.dataMocks.callResultSchema,
                    api: dx.test.dataMocks.apiErrorSchema,
                    e: dx.test.dataMocks.errorResultSchema,
                    w: weirdSchema
                });
                dx.core.data._initCache(target);
                dx.core.data._generateModelConstructors(schemas, target);
            }

            it('is created when specified in the schema', function() {
                prepareForTest({}, {});
                expect(target.rootOps.RootType.$$create).toBeDefined();
            });

            it('is not created for child types', function() {
                prepareForTest({}, {});
                expect(target.rootOps.ChildType).not.toBeDefined();
            });

            it('can be called, even when type not explicitly stated in original schema', function() {
                prepareForTest({name: 'SimpleParam'}, {});

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'));

                expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere');

            });

            it('can be called with a different kind of parameter than the type that create is defined on', function() {
                prepareForTest({name: 'SimpleParam'}, {});

                target.rootOps.WeirdCreate.$$create(target._newClientModel('SimpleParam'));

                expect(ajaxSpy.mostRecentCall.args[0].url).toContain('/somewhere');
            });

            it('throws an error if passed an invalid parameter', function() {
                prepareForTest({name: 'SimpleParam'}, {});

                expect(function() {
                    target.rootOps.WeirdCreate.$$create(target._newClientModel('APIError'));
                }).toDxFail('Must call $$create with an instance of SimpleParam.');
            });

            it('invokes the correct POST URL on the server', function() {
                prepareForTest({name: 'SimpleParam'}, {});

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'));

                expect(ajaxSpy.mostRecentCall.args[0].type).toEqual('POST');
                expect(ajaxSpy.mostRecentCall.args[0].url).toEqual('/somewhere');
            });

            it('calls success callback on success', function() {
                prepareForTest({name: 'SimpleParam'}, {});
                var successSpy = jasmine.createSpy('successSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'), {success: successSpy});

                expect(successSpy).toHaveBeenCalled();
                expect(successSpy.mostRecentCall.args[0].get('type')).toEqual('OKResult');
            });

            it('calls error callback on error', function() {
                prepareForTest({name: 'SimpleParam'}, {});
                var errorSpy = jasmine.createSpy('errorSpy');
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 404,
                        getResponseHeader: function() {
                            return 'application/json';
                        },
                        responseText: '{"type":"ErrorResult"}'
                    }, 'error', 'whatever');
                });

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'), {error: errorSpy});

                expect(errorSpy).toHaveBeenCalled();
                expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
            });

            it('copes with a timeout error', function() {
                prepareForTest({name: 'SimpleParam'}, {});
                var errorSpy = jasmine.createSpy('errorSpy');
                // FYI: a timeout jqxhr looks like: {'readyState':0,'status':0,'statusText':'timeout'}
                ajaxSpy.andCallFake(function(options) {
                    options.error({
                        status: 0,
                        readyState: 0,
                        getResponseHeader: function() {
                            return undefined;
                        },
                        statusText: 'timeout'
                    }, 'timeout', 'whatever');
                });

                target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'), {error: errorSpy});

                expect(errorSpy).toHaveBeenCalled();
                expect(errorSpy.mostRecentCall.args[0].get('type')).toEqual('ErrorResult');
            });

            it('will report an error if a create:required parameter is not set', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        first: {
                            type: 'string',
                            create: 'required'
                        }
                    }
                }, {});

                expect(function() {
                    target.rootOps.RootType.$$create(target._newClientModel('RequiredParams'));
                }).toDxFail('The attribute first is required to be non-null/non-undefined.');
            });

            it('will report an error if a create:required parameter in an embedded object is not set', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        first: {
                            type: 'string',
                            create: 'required'
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
                            create: 'required'
                        }
                    }
                });

                var payload = target._newClientModel('RequiredParams');
                payload.set('first', 'hello');

                expect(function() {
                    target.rootOps.RootType.$$create(payload);
                }).toDxFail('The attribute first is required to be non-null/non-undefined.');
            });

            it('will send a null value if the property type is "null"', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        first: {
                            type: 'null',
                            create: 'required'
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
                            create: 'required'
                        }
                    }
                });
                var payload = target._newClientModel('RequiredParams');

                target.rootOps.RootType.$$create(payload);

                expect(jQuery.ajax.mostRecentCall.args[0].data).toEqual('{"first":null,"embedded":{"first":null}}');
            });

            it('will not send non-required properties if they are null', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        createRequired: {
                            type: 'string',
                            create: 'required'
                        },
                        createOptional: {
                            type: 'string',
                            create: 'optional'
                        },
                        createReadonly: {
                            type: 'string',
                            create: 'readonly'
                        },
                        createUnspecified: {
                            type: 'string'
                        },
                        embedded: {
                            type: 'object',
                            $ref: 'two',
                            create: 'optional'
                        }
                    }
                }, {
                    name: 'ChildRequired',
                    properties: {
                        createRequired: {
                            type: 'string',
                            create: 'required'
                        },
                        createOptional: {
                            type: 'string',
                            create: 'optional'
                        },
                        createReadonly: {
                            type: 'string',
                            create: 'readonly'
                        },
                        createUnspecified: {
                            type: 'string'
                        }
                    }
                });
                var payload = target._newClientModel('RequiredParams');

                payload.set({
                    createRequired: 'one',
                    createReadonly: 'three',
                    createUnspecified: 'four',
                    embedded: {
                        createRequired: 'eleven',
                        createReadonly: 'thirteen',
                        createUnspecified: 'fourteen'
                    }
                });

                target.rootOps.RootType.$$create(payload);

                expect(jQuery.ajax.mostRecentCall.args[0].data).
                    toEqual('{"createRequired":"one","embedded":{"createRequired":"eleven"}}');
            });

            it('will send create required and optional attrs if they are non-null (but not readonly ones)', function() {
                prepareForTest({
                    name: 'RequiredParams',
                    properties: {
                        createRequired: {
                            type: 'string',
                            create: 'required'
                        },
                        createOptional: {
                            type: 'string',
                            create: 'optional'
                        },
                        createReadonly: {
                            type: 'string',
                            create: 'readonly'
                        },
                        createUnspecified: {
                            type: 'string'
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
                        createRequired: {
                            type: 'string',
                            create: 'required'
                        },
                        createOptional: {
                            type: 'string',
                            create: 'optional'
                        },
                        createReadonly: {
                            type: 'string',
                            create: 'readonly'
                        },
                        createUnspecified: {
                            type: 'string'
                        }
                    }
                });
                var payload = target._newClientModel('RequiredParams');

                payload.set({
                    createRequired: 'one',
                    createOptional: 'second',
                    createReadonly: 'three',
                    embedded: {
                        createRequired: 'eleven',
                        createOptional: 'twelve',
                        createReadonly: 'thirteen'
                    }
                });

                target.rootOps.RootType.$$create(payload);

                expect(jQuery.ajax.mostRecentCall.args[0].data).
                    toEqual('{"createRequired":"one","createOptional":"second","embedded":' +
                    '{"createRequired":"eleven","createOptional":"twelve"}}');
            });

            it('will throw an error if called with a payload when it isn\'t defined to accept one', function() {
                prepareForTest({
                    root: '/someurl',
                    name: 'NoPayload',
                    create: {}
                }, {
                    name: 'Dummy'
                });
                var payload = target._newClientModel('Dummy');

                expect(function() {
                    target.rootOps.NoPayload.$$create(payload);
                }).toDxFail(new Error('$$create does not allow a payload.'));
            });

            it('will call success when called without a payload (and it is not defined to have one)', function() {
                prepareForTest({
                    root: '/someurl',
                    name: 'NoPayload',
                    create: {}
                }, {
                    name: 'Dummy'
                });
                ajaxSpy.andCallFake(function(options) {
                    options.success({
                        type: 'OKResult'
                    });
                });
                var successSpy = jasmine.createSpy('successSpy');

                target.rootOps.NoPayload.$$create({
                    success: successSpy
                });

                expect(successSpy).toHaveBeenCalled();
            });

            describe('returned Promise', function() {
                var successSpy, errorSpy;

                beforeEach(function() {
                    successSpy = jasmine.createSpy('success');
                    errorSpy = jasmine.createSpy('error');
                });

                it('is resolved on success', function() {
                    prepareForTest({name: 'SimpleParam'}, {});
                    ajaxSpy.andCallFake(function(options) {
                        options.success({
                            type: 'OKResult'
                        });
                    });

                    var promise = target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'));
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).toHaveBeenCalled();
                    expect(errorSpy).not.toHaveBeenCalled();
                });

                it('is rejected on error', function() {
                    prepareForTest({name: 'SimpleParam'}, {});
                    var errorSpy = jasmine.createSpy('errorSpy');
                    ajaxSpy.andCallFake(function(options) {
                        options.error({
                            status: 404,
                            getResponseHeader: function() {
                                return 'application/json';
                            },
                            responseText: '{"type":"ErrorResult"}'
                        }, 'error', 'whatever');
                    });

                    var promise = target.rootOps.RootType.$$create(target._newClientModel('SimpleParam'));
                    promise.done(successSpy).fail(errorSpy);

                    expect(successSpy).not.toHaveBeenCalled();
                    expect(errorSpy).toHaveBeenCalled();
                });
            });
        });
    });

});
