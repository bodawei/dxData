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

/*global $ */

'use strict';

var _ = require('underscore');
//var Backbone = require('Backbone');
var dxLog = require('dxLog');

var util = require('../util/util.js');


/*
 * This takes a set of schemas (modified by _prepareSchemas), and creates a set of Backbone Model constructor functions
 * (and, by implication, functionality upon the models). This also creates a set of 'root operation' functions.
 * The constructor functions will be used by the level 3 API's to provide final collections to consumers of dxCore Data.
 *
 * CONSTRUCTOR FUNCTIONS
 * The models created by these constructor functions provide access to the data types that the Delphix Server works with
 * and implicitly manage the network connections to the server to get their data and perform operations on them. That
 * is, when using the models created by these constructor functions, the caller can work with the data in the server's
 * terms, and can remain insulated from managing network communication.
 *
 * Terminology notes:
 *     Attributes:       Backbone calls the name/value pairs on a Model 'attributes'.
 *     Client Model:     A model which is created on the client, and generally doesn't reflect data that exists on the
 *                       server. Most commonly, these are either parameters to operations on Server Models, or return
 *                       values from operations. Client Models are not maintained by the notification system.
 *     DSB Model:        Delphix-Schema-Based Model.  The models produced by the constructor functions this creates.
 *                       These are Backbone models that are constrained and enhanced to fit our Delphix Schema
 *                       requirements.
 *     Embedded Model:   A model that is placed 'within' another model via a object/referenceTo property in the schema.
 *     Properties:       The name/value pairs on an ordinary Javascript/JSON/JSON-Schema object are called 'properties'.
 *     Referenced Model: A model that is referenced via a string/objectReference property in another.
 *     Server Model:     A model which represents a corresponding object on the server.  These models may not be
 *                       modified from outside of the dxCore Data, since they are guaranteed to remain accurate and up
 *                       to date with the server's objects (as long as they are left inside of a collection)
 *
 * This routine (which should only be called from within the data system) consumes the schemas and creates a set of
 * Backbone Model constructor functions, one for each type in the schemas.
 *
 * The models constructed by these functions are very similar to ordinary Backbone Models, but also have a number of
 * significant differences. These differences include *incompatible* changes to the behavior of some Backbone Model
 * functions, as well as the addition of new ones.
 *
 * EVENTS
 * ready:        If you want to know if a model is ready to be used (has an initial set of data retrieved from the
 *               server), then make use of the 'ready' event, which is unique to DSB models. Ready indicates that the
 *               model has retrieved an initial set of data from the server. Unlike ordinary events, if a ready handler
 *               is assigned to a model that is already ready, that handler (and no others) will be triggered
 *               immediately. Ready handlers are  always passed the model as the first, and only, argument. The handler
 *               should have the signature (model)
 * badReference: This is triggered when a model is fetched, and a 404 is returned. The handler should have the signature
 *               (model, errorResult)
 * error:        This is reported when an error is returned from a fetch. Like ready, it will be also immediately
 *               trigger if the object is in a error state. Unlike ready, a model may go into and out of being in
 *               an error state, depending on the results of the last time it was fetched. The handler should have the
 *               signature (model, errorResult)
 * Note: The order of the triggering of badReference, error and the calling of the error handler passed to fetch are not
 * guaranteed.
 *
 * Standard Backbone properties (none of these should be changed)
 *     id              : -- : Standard
 *     idAttribute     : -- : Set to 'reference', as this is the unique ID property name for Delphix Schemas.
 *     cid             : -- : Standard
 *     attributes      : -- : Standard, but essentially private.
 *     changed         : -- : Standard, but essentially private. Use hasChanged() etc.
 *     defaults        : -- : This is not used by DSB Models
 *     validationError : -- : At this time not used.
 *     urlRoot
 *
 * Standard Backbone functions
 *     Unless otherwise noted, all functions accept only attribute names specified in the Delphix schema (they will
 *     throw an error if given something else). If an attribute is of type string/objectReference, then '$attribute' can
 *     be used to retrieve the referenced model. In the descriptions below, functions marked as S can be called on
 *     server models, while those marked as C can be called on client models.
 *
 *     get      : SC : Standard, as above.
 *     set      :  C : Standard, but accepts values for embedded models. Does not accept '$attribute' names.
 *     escape   : SC : Standard, as above. Note that Backbone's escape doesn't deal well with objects or arrays.
 *     has      : SC : Standard, as above.
 *     unset    :  C : Standard, as above. Sets attribute to default value. Embedded models clear()'ed.
 *     clear    :  C : Standard, as above. Sets attributes to default value. Embedded models clear()'ed.
 *     toJSON   : SC : Standard, as above. Recursively includes embedded models.
 *     sync     : -- : Do not use this.
 *     fetch    : -- : Do not use this. Use newClientModel() or getServerModel() instead.
 *     save     : -- : Do not use this. Use $$update() instead.
 *     destroy  : -- : Do not use this. Use $$delete() instead.
 *     keys     : SC : Standard. Does not return the '$attribute' keys.
 *     values   : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     pairs    : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     invert   : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     pick     : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     omit     : SC : Standard. Returns Embedded Models, but not Referenced Models.
 *     validate : -- : Do not use this. DSB Models do their own validation. Setting this may have bad effects.
 *     isValid  : -- : Do not use this. DSB Models always valid.
 *     url      : -- : Internal. Returns URL value used by some ajax routines
 *     parse    : -- : Internal. Processes values returned from the server.
 *     clone    : SC : Returns a Client Model which is a deep-copy of this model.
 *     isNew    : SC : Standard. (but pretty useless)
 *     hasChanged         : SC : Standard. Does not reflect $attribute names.
 *     changedAttributes  : SC : Standard. Does not reflect $attribute names.
 *     previous           : SC : Standard. Does not reflect $attribute names.
 *     previousAttributes : SC : Standard. Does not reflect $attribute names.
 *
 * DSB Model functions
 *     instanceOf    : SC : Returns whether the model is an instance of another type.
 *     isServerModel : SC : Returns true if this is a server model
 *     $$update      : S  : Updates the version of the model on the server
 *     $$delete      : S  : Deletes the server object
 *     $operation    : SC : Calls the relevant operation. Model must have a reference value to use these.
 *
 * Private to dxCore Data
 *     context._assertParametersGood    : Validate that a set of parameters are valid.
 *     context._newClientModel          : Makes a client model
 *     context._newServerModel          : Makes a server model
 *     context._getRootType             : Returns the most distant super type that has the same root property.
 *     context._convertXhrToErrorResult : Converts an xhr into an ErrorResult object.
 *
 * ROOT OPERATIONS
 * All root operations on schemas, and all create operations are stored in
 *     context.rootOps.Type.$rootOperation
 *     context.rootOps.Type.$$create
 *
 * Note: This does not alter the basic Backbone library in any way. This means this can co-exist with ordinary
 *     Backbone usage, or even other Backbone-based libraries (if they don't modify Backbone, of course).
 *
 * Parameters:
 *     schemas: The set of schemas this should generate constructors from.
 *     context: The object to put the resulting constructors (_modelConstructors) on. If not specified, puts them on
 *              'this'.
 */
function generateModelConstructors(schemas, context) {

    // Note: 'context' is the only true 'global' within this closure. Please don't add others.

    /*
     * ========================================
     * Model functions.
     * ========================================
     */

    /*
     * Backbone defines this as: Bind a callback function to an object. The callback will be invoked whenever the event
     * is fired.
     *
     * For DSB models, we provide standard behavior for this, but do some special processing if someone is listening
     * for the 'ready' or 'error' event. In that case, if we have already fetched the model (or if this is a client
     * model), then trigger the ready event immediately.  Note that if the model is already ready or in error,
     * then we will react to 'ready' or 'error' immediately without storing the listener, since this is a one
     * time pseudo-event.
     */
    function dxOn(name, callback, context) {
        var transientTrigger;

        /*
         * If the user is asking for ready, and we are already ready or in error, then trigger the ready or
         * do nothing. There is no reason to keep the event listener around for more than this call.
         * Similarly if the user is asking for the error pseudo event.
         */
        if (name === 'ready') {
            if (this._dxIsReady) {
                transientTrigger = triggerReady;
            } else if (this._dxErrorResult) {
                return;
            }
        } else if (name === 'error') {
            if (this._dxErrorResult) {
                transientTrigger = triggerError;
            } else if (this._dxIsReady) {
                return;
            }
        }

        if (transientTrigger) {
            var tempContext = {};
            Backbone.Events.on.call(this, name, callback, tempContext);
            transientTrigger(this);
            Backbone.Events.off.call(this, name, callback, tempContext);
        } else {
            Backbone.Events.on.call(this, name, callback, context);
        }
    }

    /*
     * Either 'ready' or 'error' events is triggered once in the lifecycle of a model. Cleanup listeners as soon as
     * possible.
     *
     * Without this automatic cleanup, callers would have to setup 2 listeners and cancel each other when triggered.
     * Note that we look at the list of events before triggering events so as to allow event handlers to attach new
     * handlers.
     */
    function removeEventHandlers(model, events) {
        _.each(events, function(value, name) {
            _.each(value, function(event) {
                if (event.callback) {
                    model.off(name, event.callback);
                }
            });
        });
    }

    /*
     * Get a copy of the current event handlers.
     */
    function getEventHandlers(model) {
        if (!model._events) {
            return {};
        }
        return {
            error: (model._events.error || []).slice(0),
            ready: (model._events.ready || []).slice(0)
        };
    }

    /*
     * Trigger the 'ready' event and clean up error listeners
     */
    function triggerReady(model) {
        var handlers = getEventHandlers(model);
        model.trigger('ready', model);
        removeEventHandlers(model, handlers);
    }

    /*
     * Trigger the 'error' event and clean up ready listeners
     */
    function triggerError(model) {
        var handlers = getEventHandlers(model);
        model.trigger('error', model, model._dxErrorResult);
        removeEventHandlers(model, handlers);
    }

    /*
     * Backbone defines this as: Get the current value of an attribute from the model.
     *
     * For DSB models, this does the same thing, with two additional features. First, asking for an attribute that isn't
     * in the schema definition will cause an error to be thrown.  Second, if there is an attribute named 'attr' whose
     * schema property is of type string/objectReference, then one can also get('$attr'), and this will return the
     * corresponding DSB model.
     */
    function dxGet(attrName) {
        var info = assertAndGetAttrInfo(this, attrName);

        if (isObjectRefProp(info.propDef) && info.wantsModel) {
            var referenceValue = this.attributes[info.baseName];
            if (util.isNone(referenceValue)) {
                return;
            }
            if (_.isString(referenceValue)) {
                return context._cache.getCachedModel(referenceValue, getRootType(info.propDef.referenceTo));
            }
            dxLog.fail('Tried to retrieve a related object with ' + attrName + ' but value was ' + referenceValue + '.');
        } else {
            return Backbone.Model.prototype.get.call(this, info.baseName);
        }
    }

    /*
     * Backbone defines this as: Set a hash of attributes (one or many) on the model. If any of the attributes change
     * the model's state, a 'change' event will be triggered on the model.
     *
     * For DSB Models, there are a number of differences.
     *     1) Only attributes defined in the schemas can be set.
     *     2) Attributes may only be set to values with the data type specified in the schemas.
     *     3) DSB models may contain 'embedded' DSB models (object/$ref)
     *
     * To set an attribute on an embedded DSB model, one must still specify values in JSON format. Thus:
     *     myModel.set({
     *         attr: 1,
     *         myEmbeddedModel: {
     *             embeddedAttr: 34
     *         }
     *     })
     * Note that it is legal, in some circumstances, to change the type of an embedded model with a set. Naturally,
     * on a ServerModel, only the server may do this, however on a ClientModel this can happen quite freely. The
     * important things to keep in mind are the following:
     *     a) When the type changes, the new type must be compatible with the type declared in the schema (which is to
     *        say you may change it to that type or any subtype, but may not change it to an unrelated type).
     *     b) Changing a type is equivalent to setting that embedded model to a new instance. That is, any values that
     *        were in the embedded model before the set are replaced with default values, and then the values specified
     *        to this set() routine are applied.
     *     c) However, listeners on this embedded model are not affected, and appropriate change notifications will be
     *        sent on setting.
     *
     * A DSB model may, legitimately, have an array or object that, itself, contains a DSB model (for example, an
     * APIError may contain a plain JSON object whose values are other APIErrors).  To deal with this properly, set()
     * will detect any object that has a 'type' property, whose value is a Delphix-schema type name, and create a
     * DSB model automatically. Without that type property, however, set() will treat the object as an ordinary
     * JSON object.
     *
     * Arrays in a Delphix schema may or may not have a type specified for items. If they do, set() will enforce that
     * type. If not, then the items in the array passed in will be examined and recursively processesed as appropriate.
     * Similarly, if a plain object is encountered, set() will process its values recursively (including turning them,
     * or their own properties, into DSB models as appropriate)
     *
     * A schema property defined with type=string and format=date gets some special treatment.  In that case, you can
     * pass a string in YYYY-MM-DDTHH:MM:SS.MMMZ format, or a Javascript Date object (the former will be converted to
     * a Date object internally, so immediately calling get() will not return the original string).
     */
    function dxSet(key, value, options) {
        var self = this;
        var newAttrs = {};
        var preConvertAttrs;
        var postConvertAttrs;

        if (_.isUndefined(key)) {
            return self;
        }

        if (_.isObject(key)) {
            newAttrs = key;
            options = value;

            if (newAttrs instanceof Backbone.Model) {
                newAttrs = newAttrs.toJSON();
            }
        } else {
            newAttrs[key] = value;
        }

        options = options || {};

        /*
         * Check whether this set would change the type of the model. This only allows changing to a subtype.
         */
        if (newAttrs.type && newAttrs.type !== self._dxSchema.name) {
            if (firstIsSubtypeOfSecond(newAttrs.type, self._dxSchema.name) || options._allowTypeConversion) {
                preConvertAttrs = _.clone(self.attributes);
                convertToType(self, newAttrs.type);
                postConvertAttrs = _.clone(self.attributes);
            } else {
                dxLog.fail('Tried to change this from ' + self._dxSchema.name + ' to ' + newAttrs.type + '.');
            }
        }

        /*
         * Reject the set if any of the attributes aren't of the right type
         */
        var invalidAttrs = _.omit(newAttrs, _.keys(self._dxSchema.properties || {}));
        if (!_.isEmpty(invalidAttrs)) {
            dxLog.fail(_.keys(invalidAttrs) + ' are not attributes of a model of type ' + self._dxSchema.name + '.');
        }

        /*
         * Validate types match, and prepare values to be set
         */
        var finalAttrs = {};
        var subModelsToSet = {};
        var subModelsToClear = [];
        var subModelsToConvert = {};

        _.each(newAttrs, function(newValue, newName) {
            var propDef = self._dxSchema.properties[newName];
            var newType = assertValueMatchesDefinition(newName, newValue, propDef);

            switch (newType) {
                case 'undefined':
                case 'boolean':
                case 'string':
                case 'number':
                case 'integer':
                    finalAttrs[newName] = newValue;
                    break;
                case 'null':
                    var nullable = _.any(propDef.type, function(type) {
                        return type === 'null';
                    });
                    if (self.get(newName) instanceof Backbone.Model && !nullable) {
                        subModelsToClear.push(newName);
                    } else {
                        finalAttrs[newName] = undefined;
                    }
                    break;
                case 'date':
                    if (newValue instanceof Date) {
                        finalAttrs[newName] = new Date(newValue.getTime());
                    } else {
                        finalAttrs[newName] = new Date(newValue);
                    }
                    break;
                case 'array':
                    finalAttrs[newName] = setupArray(newValue, propDef.items);
                    break;
                case 'object':
                    if (self.get(newName) instanceof Backbone.Model) {
                        if (newValue.type && self.get(newName).get('type') !== newValue.type) {
                            subModelsToConvert[newName] = newValue;
                        } else {
                            subModelsToSet[newName] = newValue;
                        }
                    } else {
                        finalAttrs[newName] = setupObject(newValue);
                    }
                    break;
            }
        });

        /*
         * Finally, set all the values
         */
        _.each(subModelsToClear, function(attrName) {
            self.get(attrName)._dxClear(options);
        });

        var revisedOptions = _.extend(_.clone(options), { _allowTypeConversion: true });
        _.each(subModelsToConvert, function(value, key) {
            var subModel = self.get(key);
            subModel._dxSet(value, revisedOptions);
        });

        _.each(subModelsToSet, function(value, key) {
            self.get(key)._dxSet(value, options);
        });

        /*
         * If we did a type converstion, we need to make sure to send all the change:AttrName events before we send
         * the final change event.  Because we're relying on the Backbone set routine, it may think it needs to send
         * the change event when it is done, but we have the potential to send a variety of other events afterwards.
         * To work around this, we store all calls to trigger() until we are done.
         */
        if (preConvertAttrs) {
            interceptTrigger(self);
        }

        /*
         * This will set all the values, and trigger change:attr events for all the attributes that changed
         * Note that if this is doing a type conversion, this will trigger changes for:
         *   - attributes that were added (though conversion) and then changed
         *   - attributes that existed before and after conversion, and changed from their converted value
         */
        var result = Backbone.Model.prototype.set.call(self, finalAttrs, options);

        if (preConvertAttrs) {
            var removedAttrs = _.omit(preConvertAttrs, _.keys(postConvertAttrs));
            var addedAttrs = _.omit(postConvertAttrs, _.keys(preConvertAttrs));
            var continuedAttrs = _.pick(preConvertAttrs, _.keys(postConvertAttrs));

            // trigger change events for the attributes were removed
            _.each(removedAttrs, function(value, key) {
                self.trigger('change:' + key, self, undefined);
            });

            // trigger change events for the attributes that were added, by conversion, but not changed
            _.each(addedAttrs, function(value, key) {
                if (addedAttrs[key] === self.attributes[key]) {
                    self.trigger('change:' + key, self, self.attributes[key]);
                }
            });

            _.each(continuedAttrs, function(value, key) {
                /*
                 * Suppress a change:attrName event if if the attr changed during the set() to the same value as before
                 * the conversion suppress event/
                 */
                if (continuedAttrs[key] === self.attributes[key] && postConvertAttrs[key] !== self.attributes[key]) {
                    self._suppressEvents.push('change:' + key);
                }
                /*
                 * Trigger a change:attrName if the value changed during conversation, but then wasn't changed by set.
                 * For example: The original value was 1, then when we changed the type we put the default value of 2
                 * in, and then Backbone's set changed it to 2.  So, set() didn't send an event, but we know that
                 * there actually was a change from the client's point of view.
                 */
                if (continuedAttrs[key] !== postConvertAttrs[key] && postConvertAttrs[key] === self.attributes[key]) {
                    self.trigger('change:' + key, self, self.attributes[key]);
                }
            });

            replayTriggers(self);
        }

        return result;
    }

    /*
     * Intercept and queue for later restoration, all calls to trigger().
     * This also sets up a temporary property on the model, _suppressEvents, which is a list of events to not
     * send when replayTriggers is called.
     */
    function interceptTrigger(model) {
        model._queuedEvents = [];
        model._storedTriggerFunction = model.trigger;
        model._suppressEvents = [];
        model.trigger = function() {
            model._queuedEvents.push(arguments);
        };
    }

    /*
     * Send all paused events on their way, with some modifications including: suppressing certain named events, and
     * assuring a change event is sent after all change:attrName events (but not if there are none)
     */
    function replayTriggers(model) {
        var changeEvent;
        var seenAttrChange = false;
        model.trigger = model._storedTriggerFunction;
        delete model._storedTriggerFunction;

        _.each(model._queuedEvents, function(args) {
            // don't send the change event yet
            if (args[0] === 'change') {
                changeEvent = args;
                return;
            }

            // don't send events we are to suppress
            if (_.contains(model._suppressEvents, args[0])) {
                return;
            }

            if (args[0].indexOf('change:') === 0) {
                seenAttrChange = true;
            }
            model.trigger.apply(model, args);
        });
        delete model._queuedEvents;
        delete model._suppressEvents;

        if (changeEvent) {
            model.trigger(changeEvent);
        } else if (seenAttrChange) {
            model.trigger('change', model);
        }
    }

    /*
     * Backbone defines this as: Returns true if the attribute is set to a non-null or non-undefined value.
     */
    function dxHas(attrName) {
        if (!_.isString(attrName)) {
            dxLog.fail('Must provide an attribute name.');
        }

        var info = getAttrInfo(this, attrName);

        // dxGet will throw an exception for unknown attributes, so reach directly into the attributes to avoid this
        return info.baseName && !util.isNone(this.attributes[info.baseName]);
    }

    /*
     * Backbone defines this as: Remove an attribute by deleting it from the internal attributes hash. Fires a 'change'
     * event unless silent is passed as an option.
     *
     * For DSB models, the behavior is a bit different:
     *  1) Calling unset() on a defined attribute will cause that to be reset to its default value, unless it is an
     *     embedded object, in which case it is equivalent to calling clear() on it.
     *  2) Calling unset() an attribute that isn't defined in the schemas will throw an error
     *  3) calling unset('$attribute') will unset 'attribute'
     *  4) This considers the default of a 'type' attribute to be the schema name, and so unset will never actually
     *     change it.
     */
    function dxUnset(attrName, options) {
        var info = assertAndGetAttrInfo(this, attrName);

        if (attrName === 'type') {
            return;
        }

        if (isEmbeddedProp(info.propDef)) {
            this.attributes[attrName].clear(options);
        } else {
            this.set(info.baseName, defaultFor(info.propDef, this._dxIsClientModel), options);
        }
    }

    /*
     * Backbone defines this as: Removes all attributes from the model, including the id attribute. Fires a 'change'
     * event unless silent is passed as an option.
     *
     * For DSB models, this resets all attributes to their default values, unless they are embedded objects, in which
     * case clear() is recursively called on them.
     */
    function dxClear(options) {
        var changes = {};
        _.each(this._dxSchema.properties, function(propDef, propName) {
            if (propName === 'type') {
                return;
            }
            if (isEmbeddedProp(propDef)) {
                this.attributes[propName]._dxClear(options);
            } else {
                changes[propName] = defaultFor(propDef, this._dxIsClientModel);
            }
        }, this);

        if (!_.isEmpty(changes)) {
            this._dxSet(changes, options);
        }
    }

    /*
     * Backbone defines this as: Return a copy of the model's attributes for JSON stringification. This can be used for
     * persistence, serialization, or for augmentation before being sent to the server.
     *
     * Our differences are that we will recursively call this on any embedded objects, and we do deep clones of any
     * objects or arrays.
     */
    function dxToJSON() {
        return jsonIze(this);
    }

    /*
     * Wrapper around standard Backbone url().  We do this because we build a common url access scheme that is
     * available to both root operations and object operations.
     */
    function dxUrl() {
        return this.url();
    }

    /*
     * Backbone defines this as: parse() is called whenever a model's data is returned by the server. The function is
     * passed the raw response object, and returns the attributes hash to be set on the model.
     *
     * Delphix values returned from the server come in several flavors:
     *  1) an ErrorResult. This means that whatever request got to us failed.
     *  2) an OKResult. This is the result of a successful call
     *  3) a 'naked' Delphix object type. This happens when a collection is parsing each object in its returned array.
     *  4) a ListResult, or other Delphix return value.  These should never happen here.
     *
     * In the case of problems (cases 1 and 4), we return undefined (we report the error result through the error result
     * handler).  For 2 we extract the object in the result and return that. For 3, assuming the type is one we know,
     * return that unchanged.  If it is an unknown type, however, we log an error and return undefined. An undefined
     * return value indicates that there is no data to be parsed out of the response.
     */
    function dxParse(response) {
        if (!response || !response.type) {
            dxLog.warn('Got an undefined response, or one without a type in parse().');
            return;
        }

        if (response.type === 'OKResult') {
            return response.result;
        } else if (isSchemaType(response.type)) {
            return response;
        } else {
            dxLog.warn('Got an unexpected type of response (' + response.type + ') in parse().');
            return;
        }
    }

    /*
     * Backbone defines this as: Returns a new instance of the model with identical attributes.
     *
     * For DSB models, this returns a client model that is a deep copy of the model. All embedded models are also
     * made as client models.
     */
    function dxClone() {
        var newModel = newClientModel(this._dxSchema.name);

        newModel.set(this.toJSON());
        newModel.changed = {};  // Shhh. we didn't actually change anything!

        return newModel;
    }

    /*
     * Returns true if the provided type name is this object's type name, or the type name of one of this model's
     * extended types.  Will throw an exception if the provided type name isn't one of the schema types.
     */
    function instanceOf(typeName) {
        if (!_.isString(typeName)) {
            dxLog.fail('instanceOf() requires a type name as a parameter.');
        }

        if (!isSchemaType(typeName)) {
            dxLog.fail(typeName + ' is not a known type name.');
        }

        var candidateTypeInfo = this._dxSchema;

        while (candidateTypeInfo) {
            if (candidateTypeInfo.name === typeName) {
                return true;
            }

            candidateTypeInfo = candidateTypeInfo.parentSchema;
        }

        return false;
    }

    function isServerModel() {
        return !this._dxIsClientModel;
    }

    /*
     * Entirely block the standard Backbone destroy() routine. We want users to call $$delete() instead.
     */
    function noDestroy() {
        dxLog.fail('Do not call destroy() directly. Instead, call $$delete().');
    }

    /*
     * Delete this model on the server.  On success, this will clear() this model.  This will also fire
     * a 'request' event on the model before making the call, and a 'sync' and 'destroy' afterwards on success.
     * Depending on the underlying schema definition, this can be called in any of these ways:
     *    $$delete([successError])  // in case of no payload defined
     *    $$delete(payload[, successError])  // in case of payload required
     *    $$delete([payload][, successError])  // in case of payload optional
     */
    function dxDelete(arg1, arg2) {
        var opDef = this._dxSchema.delete;

        if ((arg1 instanceof Backbone.Model) && !opDef.payload) {
            dxLog.fail('$$delete does not allow a payload.');
        }

        var payload = arg1;
        var successError = arg2;
        if (!opDef.payload ||
            !opDef.required && !(arg1 instanceof Backbone.Model)) {
            payload = undefined;
            successError = arg1;
        }

        assertHasReferenceAttr(this, '$delete', true);
        var preparedData = assertAndPreparePayload('$delete', opDef, payload);

        return callOperation(this, {
            data: preparedData,
            url: this.url()
        }, 'DELETE', opDef, successError);
    }

    /*
     * Create a new object on the server. It is normally called like this:
     *    $$create(payload[, successError])
     * However, it could be called in the following ways should a schema one day not require payload to do create
     *    $$create([successError])  // in case of no payload defined
     *    $$create([payload][, successError])  // in case of payload optional
     */
    function dxCreate(opDef, url, arg1, arg2) {
        if ((arg1 instanceof Backbone.Model) && !opDef.payload) {
            dxLog.fail('$$create does not allow a payload.');
        }

        var payload = arg1;
        var successError = arg2;
        if (!opDef.payload ||
            !opDef.required && !(arg1 instanceof Backbone.Model)) {
            payload = undefined;
            successError = arg1;
        }

        return callOperation({}, {
            data: assertAndPreparePayload('$create', opDef, payload),
            url: url
        }, 'POST', opDef, successError);
    }

    /*
     * Entirely block the standard Backbone save() routine. We want users to call $$update() instead.
     */
    function noSave() {
        dxLog.fail('Do not call save() directly. Instead, call $$update().');
    }

    /*
     * Update the version of this model on the server. This sends to the server:
     *  1) Any required or update:required attributes defined for this type
     *  2) Any required:false or update:optional attributes from the set passed in this function
     */
    function dxUpdate(attributes, successError) {
        var opDef = this._dxSchema.update;

        if (util.isNone(attributes) || _.isEmpty(attributes)) {
            dxLog.fail('$$update must be called with a non-empty set of attributes.');
        }
        assertHasReferenceAttr(this, '$update', !this._dxSchema.singleton);

        var newModel = this.clone();
        newModel.set(attributes);

        var preparedData = JSON.stringify(jsonIzeForUpdate(attributes, newModel, this, true));

        return callOperation(this, {
            data: preparedData,
            url: this._dxGetUrl()
        }, 'POST', opDef, successError);
    }

    /*
     * Entirely block the standard Backbone fetc() routine.
     */
    function noFetch() {
        dxLog.fail('Do not call fetch() directly. Instead, call getServerModel().');
    }

    /*
     * Mark the specified model as 'ready'. The 'triggerNotify' parameter controls whether we trigger the 'ready'
     * event. This is exposed to the level3 API so that a collection can be marked as ready before notifying consumers.
     */
    function makeReady(model, triggerNotify) {
        model._dxIsReady = true;

        _.each(model._dxSchema.properties, function(propDef, propName) {
            if (isEmbeddedProp(propDef) && model.get(propName)) {
                makeReady(model.get(propName), triggerNotify);
            }
        });

        if (triggerNotify) {
            triggerReady(model);
        }
    }

    /*
     * Handle an error for a successError callback or an array of callbacks.
     * The context error handler is invoked once unless all callbacks define a custom error handler.
     */
    function handleErrorResult(processedResult, successError) {
        var callbacks = _.isArray(successError) ? successError : [successError];
        var reportedError = false;
        _.each(callbacks, function(successError) {
            if (successError && successError.error) {
                successError.error(processedResult);
            } else if (!reportedError && (!successError || !successError.suppressDefaultErrorHandler)) {
                context.reportErrorResult(processedResult);
                reportedError = true;
            }
        });
    }

    /*
     * This is a slightly modified copy of the fetch function from knockback's version of Backbone. This is modified
     * in that it calls our own private version of set and directly calls Backbone.sync (which is all that knockback's
     * Backbone does at the moment).
     */
    function dxFetch(successError) {
        var model = this;
        model._dxFetchQueue = model._dxFetchQueue || [];
        model._dxFetchQueue.push(successError);
        if (model._dxFetchQueue.length === 1) {
            dxFetchNow(model);
        }
    }

    function dxFetchNow(model) {

        /*
         * Applies the handler to the pending request queue.
         *
         * If there is more than one callback in the queue, apply the response to entries 0..N-2 and issue a new
         * dxFetch for the most recent request.
         *
         * If dxFetch requests are issued during callback execution, they do not resolve immediately.
         */
        function makeHandler(mainHandler) {
            return function dxFetchCallbackHandler(arg) {
                var queue = model._dxFetchQueue;
                delete model._dxFetchQueue;
                var callbacks = _.first(queue, Math.max(1, queue.length - 1));
                mainHandler(arg, callbacks);
                if (queue.length > 1) {
                    model._dxFetch(_.last(queue));
                }
            };
        }

        var options = {
            parse: true,
            success: makeHandler(function(resp, callbacks) {
                if (resp && resp.type === 'ErrorResult') {
                    var processedResult = resultToModel(resp);
                    model._dxErrorResult = processedResult;
                    triggerError(model);
                    return handleErrorResult(processedResult, callbacks);
                }

                model._dxErrorResult = undefined;
                model._dxSet(model.parse(resp), options);

                makeReady(model, true);

                _.each(callbacks, function(successError) {
                    if (successError && successError.success) {
                        successError.success(model);
                    }
                });

            }),
            error: makeHandler(function(xhr, callbacks) {
                var errorResult = convertXhrToErrorResult(xhr);
                handleErrorResult(errorResult, callbacks);
                if (xhr && xhr.status === 404) {
                    model.trigger('badReference', model, errorResult);
                }
                model._dxErrorResult = errorResult;
                triggerError(model);
            })
        };

        Backbone.sync('read', model, options);
    }

    /*
     * ========================================
     * Operations: creation and handling
     * ========================================
     */

    /*
     * Examine the operations provided, and add them to the target object.
     *
     * target:     The object to add the constructed functions to
     * operations: A JSON object with keys as the operation names, and  values as definitions of that operation.
     * namePrefix  A string to prefix to the name of the operation when adding to the target
     * urlPrefix:  A string to prefix to the constructed url for the operation
     * perObject:  Whether these operations are ones that require the object's reference.
     */
    function addOperations(target, operations, namePrefix, urlPrefix, perObject) {
        _.each(operations, function(opDef, opName) {
            var opFunction;
            var opUrl = (urlPrefix === '') ? opName : urlPrefix + '/' + opName;

            if (!_.isUndefined(opDef.payload)) {
                opFunction = (_.isEmpty(opDef.payload)) ?
                    function(successError) {
                        return noPayloadFunction(this, opUrl, opDef, perObject, successError);
                    } :
                    function(payload, successFailure) {
                        return payloadFunction(this, opUrl, opDef, perObject, payload, successFailure);
                    };
            } else {
                opFunction = (_.isEmpty(opDef.parameters)) ?
                    function(successError) {
                        return noParametersFunction(this, opUrl, opDef, perObject, successError);
                    } :
                    function(parameters, successFailure) {
                        return parametersFunction(this, opUrl, opDef, perObject, parameters, successFailure);
                    };
            }

            if (_.has(opDef, 'dxOperations')) {
                addOperations(target, opDef.dxOperations, namePrefix + opName + '_', opUrl, perObject);
            }

            target['$' + namePrefix + opName] = opFunction;
        });
    }

    /*
     * Call a server function that has no payload.
     */
    function noPayloadFunction(caller, opName, opDef, perObject, successError) {
        assertHasReferenceAttr(caller, opName, perObject);

        if (successError instanceof Backbone.Model) {
            dxLog.fail('$' + opName + ' can not be called with a payload (only a success/error object).');
        }

        return callOperation(caller, {
                url: caller._dxGetUrl() + '/' + opName
            }, 'POST', opDef, successError);
    }

    /*
     * Call a server function that has a payload (which is always a single DSB model).
     */
    function payloadFunction(caller, opName, opDef, perObject, payload, successError) {
        assertHasReferenceAttr(caller, opName, perObject);

        return callOperation(caller, {
                data: assertAndPreparePayload(opName, opDef, payload),
                url: caller._dxGetUrl() + '/' + opName
            }, 'POST', opDef, successError);
    }

    /*
     * Call a server function that is a 'GET', and takes no parameters.
     */
    function noParametersFunction(caller, opName, opDef, perObject, successError) {
        assertHasReferenceAttr(caller, opName, perObject);

        return callOperation(caller, {
                url: caller._dxGetUrl() + '/' + opName
            }, 'GET', opDef, successError);
    }

    /*
     * Call a server function that expects one or more parameters.
     */
    function parametersFunction(caller, opName, opDef, perObject, parameters, successError) {
        var sendableParams;
        assertHasReferenceAttr(caller, opName, perObject);

        if (!_.isObject(parameters) && !util.isNone(parameters)) {
            dxLog.fail('$' + opName + ' must be passed a (possibly empty) hash of parameters.');
        }

        if (!util.isNone(parameters)) {
            sendableParams = checkAndConvertParameters(parameters, opDef.parameters);
        }

        return callOperation(caller, {
                data: sendableParams,
                url: caller._dxGetUrl() + '/' + opName
            }, 'GET', opDef, successError);
    }

    function assertHasReferenceAttr(model, opName, perObject) {
        if (!model.id && perObject) {
            dxLog.fail('$' + opName + ' can not be called without a reference property set.');
        }
    }

    /*
     * Invoke whatever operation was set up, above, and then handle the return values.
     * Handling a return value means:
     *  1) If a success handler was provided, and OKResult (or subtype) was returned, pass that to the handler.
     *  2) IF an error handler was provided, and an ErrorResult was returned, pass the ErrorResult to the handler.
     *     Otherwise pass it on to the standard application-wide error handler, unless suppressErrorHandler was
     *     specified.
     *  3) IF some other error occurred, wrap the HTTP failure information into a new ErrorResult and either pass
     *     onto the provided handler or the system-wide hander, unless suppressErrorHandler was specified.
     */
    function callOperation(caller, options, type, opDef, successError) {
        if (successError && _.has(successError, 'success') && !_.isFunction(successError.success)) {
            dxLog.fail('The success handler must be a function, but found a ' + typeof successError.success + '.');
        }

        if (successError && _.has(successError, 'error') && !_.isFunction(successError.error)) {
            dxLog.fail('The error handler must be a function, but found a ' + typeof successError.error + '.');
        }

        var deferred = new $.Deferred();

        var params = {
            success: function(result) {
                var processedResult;
                if (result && result.type === 'ErrorResult') {
                    processedResult = resultToModel(result);
                    handleErrorResult(processedResult, successError);
                    deferred.reject(processedResult);
                } else {
                    if (util.isNone(result) || util.isNone(result.type)) {
                        dxLog.fail('Operation returned success, but without a typed object: ' + result);
                    }
                    if (util.isNone(opDef.return) && result.result === '') {
                        delete result.result;
                    }
                    assertValueMatchesDefinition('(return value)', result.result, opDef.return);
                    processedResult = resultToModel(result);
                    if (successError && successError.success) {
                        successError.success(processedResult);
                    }
                    if (successError && successError.jsonSuccess) {
                        successError.jsonSuccess(result);
                    }
                    if (_.isFunction(caller.trigger)) {
                        caller.trigger('sync', caller);
                    }
                    deferred.resolve(processedResult);
                }
            },
            error: function(xhr) {
                var errorResult = convertXhrToErrorResult(xhr);
                handleErrorResult(errorResult, successError);
                deferred.reject(errorResult);
            }
        };

        if (_.isFunction(caller.trigger)) {
            caller.trigger('request', caller);
        }

        _.extend(params, options);

        params.type = type;

        util.ajaxCall(params);
        return deferred.promise();
    }

    /*
     * Validate that the payload matches the definition for the operation.
     */
    function assertAndPreparePayload(opName, opDef, payload) {
        if (util.isNone(payload) && opDef.payload && opDef.payload.required) {
            dxLog.fail('Must call $' + opName + ' with a payload of type ' + opDef.payload.$ref + '.');
        }

        if (!util.isNone(payload)) {
            if (!_.isObject(payload) || !(payload instanceof Backbone.Model)) {
                dxLog.fail('Must call $' + opName + ' with a backbone model.');
            }

            if (!payload.instanceOf(opDef.payload.$ref)) {
                dxLog.fail('Must call $' + opName + ' with an instance of ' + opDef.payload.$ref + '.');
            }

            return JSON.stringify(jsonIze(payload, opDef.validateAs || 'send'));
        }
    }

    /*
     * Given a parameters object (an ordinary JSON object), compare these with the parameter definitions from the
     * schemas.  If there are any type mismatches, parameters that are not supported, or required parameters that are
     * missing, throw an error.
     *
     * Return a copy of the parameters that are suitable for passing to an AJAX call (Date object converted to
     * the server date string format)
     */
    function checkAndConvertParameters(parameters, paramDefinitions) {
        parameters = parameters || {};
        var undefinedParams = _.omit(parameters, _.keys(paramDefinitions));
        if (!_.isEmpty(undefinedParams)) {
            dxLog.fail(_.keys(undefinedParams).join(', ') + ' is not a valid parameter name.');
        }

        _.each(parameters, function(value, key) {
            if (_.isUndefined(value)) {
                dxLog.fail('Can not send a request with an undefined parameter (' + key + ' is undefined).');
            }
        });

        _.each(paramDefinitions, function(paramDef, paramName) {
            if (_.has(parameters, paramName)) {
                assertValueMatchesDefinition(paramName, parameters[paramName], paramDef);
            } else if (paramDef.required) {
                dxLog.fail(paramName + ' is required, but has not been passed.');
            }
        });

        // slightly misuse the jsonIze() routine. It does what we need, even if parameters isn't a Backbone model.
        return jsonIze(parameters, 'send');
    }

    /*
     * ========================================
     * Model creation functions
     * ========================================
     */

    /*
     * Returns a new DSB model which is set to be a server model.
     */
    function newServerModel(typeName) {
        var model = makeNewModel(typeName, false);

        makeIntoServerModel(model);

        return model;
    }

    /*
     * Returns a new DSB model which is set to be a client model.
     */
    function newClientModel(typeName) {
        var model = makeNewModel(typeName, true);
        makeReady(model, true);
        return model;
    }

    /*
     * Convert a JSON result object into a client model.
     */
    function resultToModel(result) {
        var model = newClientModel(result.type);
        model.set(result);
        return model;
    }

    /*
     * Create a new model instance. Aside from creating the model, we manually populate the default set of attributes,
     * since the Backbone system doesn't really understand embedded models.
     */
    function makeNewModel(typeName, isClient) {
        if (util.isNone(typeName)) {
            dxLog.fail('To create a new model, a type name must be provided.');
        }

        if (!isSchemaType(typeName)) {
            dxLog.fail(typeName + ' is not a known type name. Can not create one.');
        } else {
            var model = new context._modelConstructors[typeName]();
            model._dxIsClientModel = isClient;
            buildDefaultAttributes(model, model._dxSchema.properties || {});
            return model;
        }
    }

    /*
     * Fill in the defaults for all attributes on the specified model.  This directly manipulates the attributes
     * property, thus bypassing the normal set() semantics.  This is actually OK, as the default Backbone behavior is
     * not to change its changedAttributes() values (etc) at creation time. Additionally, we don't want to be triggering
     * events when doing this.
     */
    function buildDefaultAttributes(model, propDefs) {
        _.each(propDefs, function(propDef, propName) {
            model.attributes[propName] = defaultFor(propDef, model._dxIsClientModel);
        });

        if (!_.isUndefined(propDefs.type)) {
            model.attributes.type = model._dxSchema.name;
        }
    }

    /*
     * Given a type definition, return the default value for that type.
     */
    function defaultFor(propDef, isClientModel) {
        var defaultValue = propDef.default;

        // Expose "null" from the server as "undefined" to our clients
        if (propDef.default === null) {
            defaultValue = undefined;
        }

        if (_.isUndefined(defaultValue) &&
            propDef.type === 'object') {
            defaultValue = (_.has(propDef, '$ref')) ?
                isClientModel ? newClientModel(propDef.$ref) : newServerModel(propDef.$ref) :
                undefined;
        }

        return defaultValue;
    }

    /*
     * Changes the specified model (and its embedded models) into a server model.
     */
    function makeIntoServerModel(model) {
        model._dxIsClientModel = false;

        if (model._dxSchema.delete) {
            model.$$delete = model._dxStandardOps.$$delete;
        }

        if (model._dxSchema.update) {
            model.$$update = model._dxStandardOps.$$update;
        }

        model.set = cantModifyServerModel;
        model.clear = cantModifyServerModel;
        model.unset = cantModifyServerModel;
        model.sync = cantModifyServerModel;

        _.each(model._dxSchema.properties, function(propDef, propName) {
            if (isEmbeddedProp(propDef)) {
                makeIntoServerModel(model.get(propName));
            }
        });
    }

    function cantModifyServerModel() {
        dxLog.fail('Can not modify a server ' + this._dxSchema.name + ' instance.');
    }

    /*
     * Given a type, locate the root parent type (which will be, when walking up the inheritance chain, the last type
     * that has the same value in its root property)
     */
    function getRootType(childType) {
        if (!_.isString(childType)) {
            dxLog.fail('Must call with a type name.');
        }

        if (!isSchemaType(childType)) {
            dxLog.fail(childType + ' is not a known type name.');
        }

        return context._modelConstructors[childType].prototype._dxSchema.rootTypeName;
    }

    /*
     * Given xn XmlHttpRequest (or the equivalent), either extract the ErrorResult object from within it and return
     * that, or manufacture an ErrorResult object which contains the HTTP failure information and return that.
     */
    function convertXhrToErrorResult(xhr) {
        var responseInfo = xhr.responseText;

        // for testing xhr may not have getResponseHeader, and not all responses have a content-type!
        var contentType = util.isNone(xhr.getResponseHeader) ? undefined :
            xhr.getResponseHeader('content-type');

        if (!util.isNone(contentType) &&
            contentType.indexOf('application/json') > -1 &&
            !_.isObject(responseInfo)) {
            try {
                responseInfo = JSON.parse(responseInfo);
            } catch (e) {
                dxLog.fail('Server response claimed to be application/json, but couldn\'t be parsed as JSON (' +
                    xhr.responseText + ').');
            }
        }

        if (responseInfo && responseInfo.type === 'ErrorResult') {
            return resultToModel(responseInfo);
        } else {
            var errorResult = newClientModel('ErrorResult');
            errorResult.get('error').set({
                details: 'Communication Error',
                commandOutput: 'HTTP Error: ' + xhr.status + '\n' +
                     'Status text: ' + xhr.statusText + '\n' +
                     'Response text: ' + xhr.responseText
            });
            return errorResult;
        }
    }

    /*
     * ========================================
     * 'subroutines' and utility functions
     * ========================================
     */

    /*
     * Validates that the attribute name is a valid attribute name for the model. If so, this returns information about
     * the attribute (see getAttrInfo).
     */
    function assertAndGetAttrInfo(model, attrName) {
        var info = getAttrInfo(model, attrName);

        if (_.isUndefined(info.propDef)) {
            dxLog.fail(attrName + ' is not a known attribute.');
        }

        return info;
    }

    /*
     * This returns information about the attribute, including its base name (if the value passed was $attr, this
     * returns 'attr'), whether this was a $-prefixed name (and thus it is actually asking for the referenced model),
     * and the definition of the schema property.
     */
    function getAttrInfo(model, attrName) {
        if (!_.isString(attrName)) {
            dxLog.fail('Must provide an attribute name.');
        }

        var baseName = attrName;
        var wantsModel = false;
        if (baseName.charAt(0) === '$') {
            baseName = baseName.substring(1);
            wantsModel = true;
        }
        var props = model._dxSchema.properties;
        var propDef = props ? props[baseName] : undefined;

        return {
            baseName: baseName,
            wantsModel: wantsModel,
            propDef: propDef
        };
    }

    var dateStringRegex = /\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ/;

    /*
     * Asserts that the specified value matches (is compatible with) the type specified by the definition.
     */
    function assertValueMatchesDefinition(name, value, def) {
        /*
         * Returns the type of the value.  The return values include Javascript typeof type (undefined, object,
         * boolean, number, string, etc) types, with JSON Schema type refinements (null, array, integer).
         */
        function typeOfValue(value) {
            if (_.isNull(value)) {
                return 'null';
            }

            if (_.isArray(value)) {
                return 'array';
            }

            if (typeof value  === 'number') {
                return (value === Math.floor(value)) ? 'integer' : 'number';
            }

            if (value instanceof Date) {
                return 'date';
            }

            if (typeof value === 'string' && dateStringRegex.exec(value)) {
                return 'date-or-string'; // could be either.
            }

            return typeof value;
        }

        function isTypeCompatible(actualType, objectType, defType, defObjectType, defFormat) {
            if (actualType === 'integer' && defType === 'number') {
                return true;
            } else if (actualType === 'null' || actualType === 'undefined') {
                return true;    // can assign null or undefined to all types
            } else if (actualType === 'date' && defType === 'string' && defFormat === 'date') {
                return true;
            } else if (actualType === 'date-or-string' && defType === 'string') {
                if (defFormat === 'date') {
                    type = 'date';
                } else {
                    type = 'string';
                }
                return true;
            } else if ((defType === 'object') && (actualType === 'object')) {
                if (_.isUndefined(defObjectType) || // definition is typeless
                    (!_.isUndefined(defObjectType) && _.isUndefined(objectType)) || // new value is typeless
                    defObjectType === objectType || // types same
                    firstIsSubtypeOfSecond(objectType, defObjectType)) { // new value is subtype
                    return true;
                } else {
                    return false;
                }
            } else {
                return defType === actualType;
            }
        }

        var type = typeOfValue(value);
        var objectType = (type === 'object') ? value.type : undefined;
        var typeMatches;

        if (_.isUndefined(def)) {
            if (util.isNone(value)) {
                return type;
            } else {
                dxLog.fail(name + ' has a value, but it has no definition.');
            }
        }

        if (_.isArray(def.type)) {
            typeMatches = _.find(def.type, function(defType) {
                return isTypeCompatible(type, objectType, defType, def.$ref, def.format);
            });
        } else {
            typeMatches = isTypeCompatible(type, objectType, def.type, def.$ref, def.format);
        }

        if (!typeMatches) {
            if (!def.$ref) {
                dxLog.fail(name + ' has to be type ' + ((def.type === 'string' && def.format === 'date') ?
                    'date' : def.type) + ' but is ' + type + ' (' + JSON.stringify(value) + ')');
            } else {
                dxLog.fail(name + ' has to be type ' + def.type + '/' + def.$ref + ' but is ' + type + '/' + objectType);
            }
        }

        /*
         * Note: def.enum throws an error in IE8.  We're also good with undefined/null from previous checks but those
         * values obviously aren't part of the enum
         */
        if (def.enum && !util.isNone(value) && !_.contains(def.enum, value)) {
            dxLog.fail(name + ' is an enum and has to be one of ' + JSON.stringify(def.enum) + ' but is ' +
                JSON.stringify(value));
        }

        return type;
    }

    /*
     * Change the model to another type.  This is done "in place" since we want to preserve any listeners that may
     * have been attached to this object.
     *
     * This returns true if this removed any attributes (it also triggers a 'change:attrName' event for each)
     */
    function convertToType(model, newType) {
        var SourceConstructor = context._modelConstructors[model.get('type')];
        var TargetConstructor = context._modelConstructors[newType];

        // add metadata from the target type, overriding our own.
        model._dxSchema = TargetConstructor.prototype._dxSchema;
        model.urlRoot = TargetConstructor.prototype._dxSchema.root;

        // replace our attributes
        model.attributes = {};
        buildDefaultAttributes(model, model._dxSchema.properties);

        // Remove any operations we previously may have added to this object.
        _.each(model, function(value, name) {
            if (name.charAt(0) === '$') {
                delete model[name];
            }
        });

        /*
         * This is really sad. Since we can't change the prototype of the object at runtime, we necessarily inherit the
         * operations from its prototype.  But if by chance we are converting to a type that doesn't have those
         * operations, we should not allow someone to call them. Insert a dummy function on the leaf object in the
         * prototype chain to keep anyone from actually calling it.
         */
        _.each(SourceConstructor.prototype, function(value, name) {
            if (name.charAt(0) === '$') {
                model[name] = blockPrototypeOperation;
            }
        });

        // Now actually add the operations to this that it should have based on the type it is being converted to.
        _.each(TargetConstructor.prototype, function(value, name) {
            if (name.charAt(0) === '$') {
                model[name] = value;
            }
        });

        if (model._dxSchema.delete) {
            model.$$delete = dxDelete;
        }

        if (model._dxSchema.update) {
            model.$$update = dxUpdate;
        }
    }

    function blockPrototypeOperation() {
        dxLog.fail('This operation does not exist on this instance. (it has been converted from a type that had it).');
    }

    function firstIsSubtypeOfSecond(childType, parentType) {
        var candidateInfo = isSchemaType(childType) ?
            context._modelConstructors[childType].prototype._dxSchema :
            undefined;

        while (candidateInfo) {
            if (candidateInfo.name === parentType) {
                return true;
            }

            candidateInfo = candidateInfo.parentSchema;
        }

        return false;
    }

    /*
     * As part of the set() process, we can take a JSON array, and convert it into an array ready to be set on the
     * model. This involves two special processes: If an 'items' property has been specified, enforce the type
     * constraint expressed there, and if an object is found that could be converted into a DSB model, create a new
     * model and add it.
     */
    function setupArray(arrayValue, itemDef) {
        var newArray = [];

        _.each(arrayValue, function(value) {
            if (!_.isUndefined(itemDef)) {
                assertValueMatchesDefinition('(array item)', value, itemDef);
            }

            if (_.isArray(value)) {
                newArray.push(setupArray(value));
            } else if (_.isObject(value)) {
                newArray.push(setupObject(value));
            } else {
                newArray.push(value);
            }
        });

        return newArray;
    }

    /*
     * As part of the set() process, take the provided JSON object data, and either convert it into a DSB model, using
     * the type value in the JSON object, or recursively process all the elements in the object and set those on the
     * object this returns.
     */
    function setupObject(objectValue) {
        var newObj = {};

        if (objectValue instanceof Backbone.Model) {
            objectValue = objectValue.toJSON();
        }

        if (isSchemaType(objectValue.type)) {
            newObj = context._cache.getCachedModelFromProperties(objectValue);
        } else {
            _.each(objectValue, function(value, key) {
                if (_.isArray(value)) {
                    newObj[key] = setupArray(value);
                } else if (_.isObject(value)) {
                    newObj[key] = setupObject(value);
                } else {
                    newObj[key] = value;
                }
            });
        }

        return newObj;
    }

    /*
     * Return a version of this model in JSON format, according to the specified mode. The mode may have several values
     * which cause different versions of the model to be returned:
     *
     * undefined: Return all properties.
     * send: Return all non-null required and optional values.
     * create: Return all non-null create required and optional values, as well as required ones.
     * update: Return all non-null update required and optional values, as well as required ones.
     *
     * send, create and update all throw errors if a required attribute is null or undefined (unless that attribute
     * is of type 'null')
     */
    function jsonIze(value, mode) {
        var result;
        if (value instanceof Backbone.Model) {
            result = {};
            _.each(value._dxSchema.properties, function(propDef, key) {
                var attrValue = value.get(key);

                // ordinary jsonizing returns everything
                if (_.isUndefined(mode)) {
                    result[key] = jsonIze(attrValue, mode);
                    return;
                }

                // Don't include read-only properties when sending a property
                if (isReadOnly(propDef, mode)) {
                    return;
                }

                var required = isRequired(propDef, mode);

                // Don't send null when it won't be accepted
                if (util.isNone(attrValue) && !isNullableType(propDef)) {
                    if (required) {
                        dxLog.fail('The attribute ' + key + ' is required to be non-null/non-undefined.');
                    }
                    return;
                }

                result[key] = jsonIze(attrValue, mode);
            });
        } else if (_.isArray(value)) {
            result = [];
            _.each(value, function(item) {
                result.push(jsonIze(item, mode));
            });
        } else if (_.isObject(value)) {
            if (value instanceof Date) {
                result = value.toJSON();
            } else {
                result = {};
                _.each(value, function(propValue, key) {
                    result[key] = jsonIze(propValue, mode);
                });
            }
        } else {
            result = _.isUndefined(value) ? null : value;
        }

        return result;
    }

    /*
     * Doing a $$update requires some special handling, hence it's own jsonize routine here.  The parameters to this are
     *    updateAttrs:   A raw object/hash of attributes that the user has asked to send as an update
     *                   This is needed because it gives us a direct view of which attributes the caller wants to send.
     *    updateModel:   A model that has been .set() with those attributes. This is needed because it has the forms of
     *                   the attributes that have already been fully processed by the overall model system here.
     *    baseModel:     The model that the update is related to. This is needed in order to retrieve some values that
     *                   must be included in the update but were not explicitly set. It also helps us determine when a
     *                   value doesn't need to be sent because the new value is the same as the old.
     *    propsRequired: Whether the properties generated by this call must be included. Always true at the top level,
     *                   and each recursive call sets it based on the schema definition.
     *
     * The basic algorithm here is:
     *    Go over each property in the schema definition
     *    If there is an update attribute for it, then add that to the hash of properties we will return
     *      (but use the jsonIzed version of that attribute from the updateModel, to get all the benefits of proper
     *      jsonization)
     *    However, there are some caveats:
     *       - If the update specifies a value which is not changed, don't send a duplicate
     *       - If a property is required for update, but isn't included in the attributes, grab it from the
     *         base model
     *       - If the update attributes specified an undefined value, and the property is allowed to be null,
     *         we send a null.
     *       - Embedded models need special handling.  If the embedded model is required, then we simply add it to
     *         the set of properties we are returning. If the embedded model is optional, however, then if there are no
     *         new values in that embedded model (even if there are required properties there) then it is not included
     *         in the update.  This, then, is the reason for the propsRequired parameter and the propCount in the
     *         routine.  We tell each subsequent call whether we want it to return the properties even if there is
     *         nothing new.
     */
    function jsonIzeForUpdate(rawUpdateObj, updateModel, baseModel, propsRequired) {
        var jsonUpdatePayload = {};
        var propCount = 0;
        _.each(updateModel._dxSchema.properties, function(propDef, key) {
            // Don't include read-only properties when sending a property
            if (isReadOnly(propDef, 'update')) {
                return;
            }

            var required = isRequired(propDef, 'update');

            if (isEmbeddedProp(propDef)) {
                var subProps = rawUpdateObj ? rawUpdateObj[key] : undefined;
                var baseEmbedded = baseModel.get(key);
                var updateEmbedded = updateModel.get(key);
                var embJson;
                /*
                 * The update may legitimately be trying to change the type of an embedded object. In this case we can't
                 * keep using the baseModel's embedded model to extract properties from (in particular, there may be
                 * properties in the 'update' data that aren't in the embedded model, so there's nothing to extract).
                 * Further, our definition of changing types in embedded models is that we do not preserve any
                 * properties properties that were there before, even if they could be. In this regard, changing the
                 * type isn't an overlay, but is instead a replace operation. To make this work here we create a new
                 * model to be used as the base model for the recursive call to jsonIzing.
                 */
                if (baseEmbedded.get('type') !== updateEmbedded.get('type')) {
                    // Doing an update that changes the type really means we are just sending the new data
                    embJson = jsonIze(updateEmbedded, 'update');
                } else {
                    embJson = jsonIzeForUpdate(subProps, updateEmbedded, baseEmbedded, required);
                }
                if (!_.isUndefined(embJson)) {
                    jsonUpdatePayload[key] = embJson;
                    propCount++;
                }
            } else {
                var baseAttrJson = jsonIze(baseModel.get(key), 'update');
                var updateAttrJson = jsonIze(updateModel.get(key), 'update');
                var updateValue = updateWithChangedValue(rawUpdateObj, key, baseAttrJson, updateAttrJson);

                if (updateValue) {
                    throwIfBadNull(updateAttrJson, propDef, key);
                    propCount++;
                    jsonUpdatePayload[key] = updateAttrJson;
                }
                if (required && !updateValue) {
                    throwIfBadNull(baseAttrJson, propDef, key);
                    jsonUpdatePayload[key] = baseAttrJson;
                }
            }
        });

        var returnValue = propsRequired || (propCount > 0);

        return returnValue ? jsonUpdatePayload : undefined;
    }

    function updateWithChangedValue(rawUpdateObj, key, baseAttrJson, updateAttrJson) {
        return (!_.isUndefined(rawUpdateObj) && _.has(rawUpdateObj, key) && !_.isEqual(baseAttrJson, updateAttrJson));
    }

    /*
     * Determine whether the specified property is 'read only' in the current jsonizing mode. It is readonly if
     * it there are no required or create/update settings, or if it is explicitly readonly.
     */
    function isReadOnly(propDef, mode) {
        var readOnly =
            (mode === 'create' &&
                ((_.isUndefined(propDef.create) && _.isUndefined(propDef.required)) ||
                    propDef.create === 'readonly')) ||
            (mode === 'update' &&
                ((_.isUndefined(propDef.update) && _.isUndefined(propDef.required)) ||
                    propDef.update === 'readonly'));
        return readOnly;
    }

    /*
     * Determine whether the specified property is 'required' given the specified jsonizing mode.
     */
    function isRequired(propDef, mode) {
        var required = (propDef.required === true) ||
            (propDef.create === 'required' && mode === 'create') ||
            (propDef.update === 'required' && mode === 'update');
        return required;
    }

    /*
     * Determine whether the specified property is one that allows null values
     */
    function isNullableType(propDef) {
        return _.isArray(propDef.type) ? _.contains(propDef.type, 'null') : (propDef.type === 'null');
    }

    function isEmbeddedProp(propDef) {
        return (propDef.type === 'object' && _.has(propDef, '$ref'));
    }

    function isObjectRefProp(propDef) {
        if (_.isArray(propDef.type)) {
            return _.contains(propDef.type, 'string') && propDef.format === 'objectReference';
        }
        return (propDef.type === 'string' && propDef.format === 'objectReference');
    }

    function throwIfBadNull(value, propDef, key) {
        if (util.isNone(value) && !isNullableType(propDef)) {
            dxLog.fail('The attribute ' + key + ' is required to be non-null/non-undefined.');
        }
    }

    function isSchemaType(typeName) {
        return !!context._modelConstructors[typeName];
    }

    /*
     * ========================================
     * Actually do the work of this function
     * ========================================
     */

    context = context || this;
    context._modelConstructors = context._modelConstructors || {};
    context.rootOps = context.rootOps || {};

    _.each(schemas, function(schema, typeName) {
        var rwModel = {
            _dxSchema: schema,
            _dxIsReady: false,
            _dxErrorResult: undefined,
            _dxIsClientModel: false,
            _dxStandardOps: {},
            idAttribute: 'reference',
            urlRoot: schema.root,
            _dxSet: dxSet,
            _dxClear: dxClear,
            _dxFetch: dxFetch,
            _dxGetUrl : dxUrl,
            _dxMakeReady: function() {
                makeReady(this, false);
            },
            on: dxOn,
            get: dxGet,
            set: dxSet,
            has: dxHas,
            unset: dxUnset,
            clear: dxClear,
            toJSON: dxToJSON,
            fetch: noFetch,
            save: noSave,
            destroy: noDestroy,
            parse: dxParse,
            clone: dxClone,
            instanceOf: instanceOf,
            isServerModel: isServerModel
        };

        function getRootUrl() {
            return schema.root;
        }

        addOperations(rwModel, schema.operations, '', '', true);

        if (schema.rootOperations) {
            /*
             * Root operations on singletons are, essentially object operations, as far as the client object model
             * is concerned. So, treat those root operations as object operations.  However, there are also some
             * singleton 'pseudo-objects' (e.g. delphix_common) which only exist to hold a few operations, so those we
             * put on the rootOps object.  These pseudo-objects all prefixed by 'delphix_'.
             */
            if (schema.singleton && schema.name.indexOf('delphix_') !== 0) {
                addOperations(rwModel, schema.rootOperations, '', '', false);
            } else {
                context.rootOps[typeName] = {};
                context.rootOps[typeName]._dxGetUrl = getRootUrl;
                addOperations(context.rootOps[typeName], schema.rootOperations, '', '', false);
            }
        }

        if (schema.create) {
            context.rootOps[typeName] = context.rootOps[typeName] || {};
            context.rootOps[typeName].$$create = function(payload, successError) {
                return dxCreate(schema.create, getRootUrl(), payload, successError);
            };
        }

        if (schema.delete) {
            rwModel._dxStandardOps.$$delete = dxDelete;
        }

        if (schema.update) {
            rwModel._dxStandardOps.$$update = dxUpdate;
        }

        context._modelConstructors[typeName] = Backbone.Model.extend(rwModel);
    });

    _.extend(context, {
        _checkAndConvertParameters: checkAndConvertParameters,
        _newServerModel: newServerModel,
        _newClientModel: newClientModel,
        _getRootType: getRootType,
        _convertXhrToErrorResult: convertXhrToErrorResult,
        _handleErrorResult: handleErrorResult
    });

    // Add a trivial function for reporting an ErrorResult.  This is added for testing and only if level3 isn't here.
    if (!context.reportErrorResult) {
        context.reportErrorResult = function() {};
    }
};

module.exports = generateModelConstructors;
