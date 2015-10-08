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

'use strict';

var schema = require('../../../layer1/schema.js');
var initCache = require('../../cache.js');
var FilterUtil = require('../../FilterUtil.js');
var generateModelConstructors = require('../../model.js');
var generateCollectionConstructors = require('../../collection.js');
var CreationListener = require('../../creationListener.js');
var CONSTANT = require('../../../util/constant.js');

describe('level2 creation listener', function() {
    var context = {};
    var filterSpy;
    var filters;

    beforeEach(function() {
        var schemaType = {
            root: '/someURL',
            name: 'Type',
            list: {}
        };
        context = {};
        filterSpy = jasmine.createSpy('filterSpy').andCallFake(function(collection, model, handler) {});
        filters = {
            Type: filterSpy
        };
        var schemas = schema.prepareSchemas({r: schemaType});
        initCache(context);
        generateModelConstructors(schemas, context);
        generateCollectionConstructors(schemas, filters, context);
    });

    it('invokes the callback on notifications', function() {
        filterSpy.andCallFake(function(collection, model, handler) {
            handler(CONSTANT.FILTER_RESULT.INCLUDE);
        });
        var models = [];
        var creationListener = new CreationListener({
            typeName: 'Type',
            callback: function(model) {
                models.push(model);
            },
            disposeCallback: function() {},
            filters: filters,
            context: context
        });
        var model1 = {};
        var model2 = {};
        creationListener._dxAddOrRemove(model1);
        creationListener._dxAddOrRemove(model2);
        expect(models).toEqual([model1, model2]);
    });

    it('supports undefined queryParameters', function() {
        var creationListener = new CreationListener({
            typeName: 'Type',
            callback: function() {},
            disposeCallback: function() {},
            filters: filters,
            context: context
        });
        expect(creationListener.getQueryParameters()).toBeUndefined();
    });

    it('supports defined queryParameters', function() {
        var creationListener = new CreationListener({
            typeName: 'Type',
            queryParams: {
                user: 'USER-2'
            },
            callback: function() {},
            disposeCallback: function() {},
            filters: filters,
            context: context
        });
        expect(creationListener.getQueryParameters()).toEqual({
            user: 'USER-2'
        });
    });

    it('does not invokes the callback on notifications when the filter excludes the model', function() {
        filterSpy.andCallFake(function(collection, model, handler) {
            handler(CONSTANT.FILTER_RESULT.EXCLUDE);
        });
        var callbackSpy = jasmine.createSpy('callback');
        var creationListener = new CreationListener({
            typeName: 'Type',
            callback: callbackSpy,
            disposeCallback: function() {},
            filters: filters,
            context: context
        });
        var model1 = {};
        creationListener._dxAddOrRemove(model1);
        expect(callbackSpy).not.toHaveBeenCalled();
    });

    it('blows up if the filter is UNKNOWN', function() {
        filterSpy.andCallFake(function(collection, model, handler) {
            handler(CONSTANT.FILTER_RESULT.UNKNOWN);
        });
        var creationListener = new CreationListener({
            typeName: 'Type',
            callback: function() {},
            disposeCallback: function() {},
            filters: filters,
            context: context
        });
        expect(function() {
            creationListener._dxAddOrRemove({});
        }).toDxFail('UNKNOWN filter result not supported by creation listeners');
    });

    it('blows up if the filter is an unknown result', function() {
        filterSpy.andCallFake(function(collection, model, handler) {
            handler('Bogus');
        });
        var creationListener = new CreationListener({
            typeName: 'Type',
            callback: function() {},
            disposeCallback: function() {},
            filters: filters,
            context: context
        });
        expect(function() {
            creationListener._dxAddOrRemove({});
        }).toDxFail('Filter returned an invalid value.');
    });

    it('throws an error if called with a non-function as the callback parameter', function() {
        expect(function() {
            new CreationListener({
                typeName: 'Type',
                callback: 5,
                filters: filters,
                context: context
            });
        }).toDxFail('Callback must be provided as a function.');
    });

    it('marks self as no longer in use on disposal', function() {
        var creationListener = new CreationListener({
            typeName: 'Type',
            callback: function() {},
            filters: filters,
            context: context
        });
        creationListener.dispose();
        expect(creationListener.inUse).toBe(false);
    });
});
