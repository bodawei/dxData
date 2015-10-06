require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//     Backbone.js 1.1.2

//     (c) 2010-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(root, factory) {

  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore');
    factory(root, exports, _);

  // Finally, as a browser global.
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(this, function(root, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create local references to array methods we'll want to use later.
  var array = [];
  var push = array.push;
  var slice = array.slice;
  var splice = array.splice;

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.1.2';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = void 0;
        return this;
      }
      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeningTo = this._listeningTo;
      if (!listeningTo) return this;
      var remove = !name && !callback;
      if (!callback && typeof name === 'object') callback = this;
      if (obj) (listeningTo = {})[obj._listenId] = obj;
      for (var id in listeningTo) {
        obj = listeningTo[id];
        obj.off(name, callback, this);
        if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeningTo = this._listeningTo || (this._listeningTo = {});
      var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
      listeningTo[id] = obj;
      if (!callback && typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId('c');
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      var attr, attrs, unset, changes, silent, changing, prev, current;
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      unset           = options.unset;
      silent          = options.silent;
      changes         = [];
      changing        = this._changing;
      this._changing  = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }
      current = this.attributes, prev = this._previousAttributes;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      for (attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          this.changed[attr] = val;
        } else {
          delete this.changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0, l = changes.length; i < l; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var val, changed = false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      for (var attr in diff) {
        if (_.isEqual(old[attr], (val = diff[attr]))) continue;
        (changed || (changed = {}))[attr] = val;
      }
      return changed;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server. If the server's representation of the
    // model differs from its current attributes, they will be overridden,
    // triggering a `"change"` event.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        if (!model.set(model.parse(resp, options), options)) return false;
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      var attrs, method, xhr, attributes = this.attributes;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true}, options);

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !options.wait) {
        if (!this.set(attrs, options)) return false;
      } else {
        if (!this._validate(attrs, options)) return false;
      }

      // Set temporary attributes if `{wait: true}`.
      if (attrs && options.wait) {
        this.attributes = _.extend({}, attributes, attrs);
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = model.parse(resp, options);
        if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
        if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
          return false;
        }
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch') options.attrs = attrs;
      xhr = this.sync(method, this, options);

      // Restore attributes.
      if (attrs && options.wait) this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;

      var destroy = function() {
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (options.wait || model.isNew()) destroy();
        if (success) success(model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      if (this.isNew()) {
        options.success();
        return false;
      }
      wrapError(this, options);

      var xhr = this.sync('delete', this, options);
      if (!options.wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(this.id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.extend(options || {}, { validate: true }));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model.
  var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  _.each(modelMethods, function(method) {
    Model.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.attributes);
      return _[method].apply(_, args);
    };
  });

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analagous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model){ return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      var singular = !_.isArray(models);
      models = singular ? [models] : _.clone(models);
      options || (options = {});
      var i, l, index, model;
      for (i = 0, l = models.length; i < l; i++) {
        model = models[i] = this.get(models[i]);
        if (!model) continue;
        delete this._byId[model.id];
        delete this._byId[model.cid];
        index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;
        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }
        this._removeReference(model, options);
      }
      return singular ? models[0] : models;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      options = _.defaults({}, options, setOptions);
      if (options.parse) models = this.parse(models, options);
      var singular = !_.isArray(models);
      models = singular ? (models ? [models] : []) : _.clone(models);
      var i, l, id, model, attrs, existing, sort;
      var at = options.at;
      var targetModel = this.model;
      var sortable = this.comparator && (at == null) && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;
      var toAdd = [], toRemove = [], modelMap = {};
      var add = options.add, merge = options.merge, remove = options.remove;
      var order = !sortable && add && remove ? [] : false;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      for (i = 0, l = models.length; i < l; i++) {
        attrs = models[i] || {};
        if (attrs instanceof Model) {
          id = model = attrs;
        } else {
          id = attrs[targetModel.prototype.idAttribute || 'id'];
        }

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        if (existing = this.get(id)) {
          if (remove) modelMap[existing.cid] = true;
          if (merge) {
            attrs = attrs === model ? model.attributes : attrs;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(attrs, options);
          if (!model) continue;
          toAdd.push(model);
          this._addReference(model, options);
        }

        // Do not add multiple models with the same `id`.
        model = existing || model;
        if (order && (model.isNew() || !modelMap[model.id])) order.push(model);
        modelMap[model.id] = true;
      }

      // Remove nonexistent models if appropriate.
      if (remove) {
        for (i = 0, l = this.length; i < l; ++i) {
          if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
        }
        if (toRemove.length) this.remove(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      if (toAdd.length || (order && order.length)) {
        if (sortable) sort = true;
        this.length += toAdd.length;
        if (at != null) {
          for (i = 0, l = toAdd.length; i < l; i++) {
            this.models.splice(at + i, 0, toAdd[i]);
          }
        } else {
          if (order) this.models.length = 0;
          var orderedModels = order || toAdd;
          for (i = 0, l = orderedModels.length; i < l; i++) {
            this.models.push(orderedModels[i]);
          }
        }
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort events.
      if (!options.silent) {
        for (i = 0, l = toAdd.length; i < l; i++) {
          (model = toAdd[i]).trigger('add', model, this, options);
        }
        if (sort || (order && order.length)) this.trigger('sort', this, options);
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options || (options = {});
      for (var i = 0, l = this.models.length; i < l; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      this.remove(model, options);
      return model;
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      this.remove(model, options);
      return model;
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id.
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj] || this._byId[obj.id] || this._byId[obj.cid];
    },

    // Get the model at the given index.
    at: function(index) {
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      if (_.isEmpty(attrs)) return first ? void 0 : [];
      return this[first ? 'find' : 'filter'](function(model) {
        for (var key in attrs) {
          if (attrs[key] !== model.get(key)) return false;
        }
        return true;
      });
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      // Run sort based on type of `comparator`.
      if (_.isString(this.comparator) || this.comparator.length === 1) {
        this.models = this.sortBy(this.comparator, this);
      } else {
        this.models.sort(_.bind(this.comparator, this));
      }

      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return _.invoke(this.models, 'get', attr);
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success(collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      if (!(model = this._prepareModel(model, options))) return false;
      if (!options.wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(model, resp) {
        if (options.wait) collection.add(model, options);
        if (success) success(model, resp, options);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models);
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (attrs instanceof Model) return attrs;
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      if (model.id != null) this._byId[model.id] = model;
      if (!model.collection) model.collection = this;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model, options) {
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (model && event === 'change:' + model.idAttribute) {
        delete this._byId[model.previous(model.idAttribute)];
        if (model.id != null) this._byId[model.id] = model;
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
    'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
    'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
    'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
    'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
    'lastIndexOf', 'isEmpty', 'chain', 'sample'];

  // Mix in each Underscore method as a proxy to `Collection#models`.
  _.each(methods, function(method) {
    Collection.prototype[method] = function() {
      var args = slice.call(arguments);
      args.unshift(this.models);
      return _[method].apply(_, args);
    };
  });

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

  // Use attributes instead of properties.
  _.each(attributeMethods, function(method) {
    Collection.prototype[method] = function(value, context) {
      var iterator = _.isFunction(value) ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    options || (options = {});
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
    this.delegateEvents();
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this.$el.remove();
      this.stopListening();
      return this;
    },

    // Change the view's element (`this.el` property), including event
    // re-delegation.
    setElement: function(element, delegate) {
      if (this.$el) this.undelegateEvents();
      this.$el = element instanceof Backbone.$ ? element : Backbone.$(element);
      this.el = this.$el[0];
      if (delegate !== false) this.delegateEvents();
      return this;
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    // This only works for delegate-able events: not `focus`, `blur`, and
    // not `change`, `submit`, and `reset` in Internet Explorer.
    delegateEvents: function(events) {
      if (!(events || (events = _.result(this, 'events')))) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[events[key]];
        if (!method) continue;

        var match = key.match(delegateEventSplitter);
        var eventName = match[1], selector = match[2];
        method = _.bind(method, this);
        eventName += '.delegateEvents' + this.cid;
        if (selector === '') {
          this.$el.on(eventName, method);
        } else {
          this.$el.on(eventName, selector, method);
        }
      }
      return this;
    },

    // Clears all callbacks previously bound to the view with `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        var $el = Backbone.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
        this.setElement($el, false);
      } else {
        this.setElement(_.result(this, 'el'), false);
      }
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // If we're sending a `PATCH` request, and we're in an old Internet Explorer
    // that still has ActiveX enabled by default, override jQuery to use that
    // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
    if (params.type === 'PATCH' && noXhrPatch) {
      params.xhr = function() {
        return new ActiveXObject("Microsoft.XMLHTTP");
      };
    }

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  var noXhrPatch =
    typeof window !== 'undefined' && !!window.ActiveXObject &&
      !(window.XMLHttpRequest && (new XMLHttpRequest).dispatchEvent);

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        router.execute(callback, args);
        router.trigger.apply(router, ['route:' + name].concat(args));
        router.trigger('route', name, args);
        Backbone.history.trigger('route', router, name, args);
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    _.bindAll(this, 'checkUrl');

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for detecting MSIE.
  var isExplorer = /msie [\w.]+/;

  // Cached regex for removing a trailing slash.
  var trailingSlash = /\/$/;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      return this.location.pathname.replace(/[^\/]$/, '$&/') === this.root;
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the cross-browser normalized URL fragment, either from the URL,
    // the hash, or the override.
    getFragment: function(fragment, forcePushState) {
      if (fragment == null) {
        if (this._hasPushState || !this._wantsHashChange || forcePushState) {
          fragment = decodeURI(this.location.pathname + this.location.search);
          var root = this.root.replace(trailingSlash, '');
          if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error("Backbone.history has already been started");
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
      var fragment          = this.getFragment();
      var docMode           = document.documentMode;
      var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      if (oldIE && this._wantsHashChange) {
        var frame = Backbone.$('<iframe src="javascript:0" tabindex="-1">');
        this.iframe = frame.hide().appendTo('body')[0].contentWindow;
        this.navigate(fragment);
      }

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._hasPushState) {
        Backbone.$(window).on('popstate', this.checkUrl);
      } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
        Backbone.$(window).on('hashchange', this.checkUrl);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      // Determine if we need to change the base url, for a pushState link
      // opened by a non-pushState browser.
      this.fragment = fragment;
      var loc = this.location;

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          this.fragment = this.getFragment(null, true);
          this.location.replace(this.root + '#' + this.fragment);
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot() && loc.hash) {
          this.fragment = this.getHash().replace(routeStripper, '');
          this.history.replaceState({}, document.title, this.root + this.fragment);
        }

      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      Backbone.$(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();
      if (current === this.fragment && this.iframe) {
        current = this.getFragment(this.getHash(this.iframe));
      }
      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      fragment = this.fragment = this.getFragment(fragment);
      return _.any(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      var url = this.root + (fragment = this.getFragment(fragment || ''));

      // Strip the hash for matching.
      fragment = fragment.replace(pathStripper, '');

      if (this.fragment === fragment) return;
      this.fragment = fragment;

      // Don't include a trailing slash on the root.
      if (fragment === '' && url !== '/') url = url.slice(0, -1);

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._hasPushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if(!options.replace) this.iframe.document.open().close();
          this._updateHash(this.iframe.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error(model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;

}));

},{"underscore":"underscore"}],2:[function(require,module,exports){
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

/*global dx, require, module */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');
var util = require('../util/util.js');
var constant = require('../util/constant.js');

/*
 * Do top-level processing of each schema. This involves:
 *  1) If the schema has no name, replace it with a name, based on the schemaKey, that can be used as a Javascript
 *     identifier.
 *  2) Replace the extends schemaKey (if present) with the name of the parent schema.
 *  3) Add a parentSchema property with a reference to the parent schema, if any.
 *  4) Add the name of the closest ancestor schema type that had a root property.
 *  5) Inherit the parent's root property, if this itself doesn't have one.
 */
function processSchema(schema, schemaKey, sourceSchemas, newSchemas, preserveUnneeded) {
    /*
     * Most schemas have a name. However, not all do.  We must nevertheless expose those schemas as they have root
     * operations on them. Thus, we convert the key into a form that can be used to identify them.
     */
    schema.name = schemaKeyToTypeName(schemaKey, sourceSchemas);

    // If this schema has already been processed (see recursive call, below), return it
    if (newSchemas[schema.name]) {
        return newSchemas[schema.name];
    }

    newSchemas[schema.name] = schema;

    if (schema.root) {
        schema.rootTypeName = schema.name;
    }

    // Process the parent schema, if any. This assumes all extends schemas have just a $ref property.
    var parentSchema = schema.extends;
    if (parentSchema) {
        schema.parentSchema = processSchema(sourceSchemas[parentSchema.$ref], parentSchema.$ref,
            sourceSchemas, newSchemas);
        parentSchema.$ref = schemaKeyToTypeName(parentSchema.$ref, sourceSchemas);
        parentSchema = schema.parentSchema;

        if (!schema.rootTypeName) {
            schema.rootTypeName = parentSchema.rootTypeName;
        }

        schema.root = schema.root || parentSchema.root;
    }

    if (!preserveUnneeded) {
        delete schema.description;
    }

    processProperties(schema, parentSchema, sourceSchemas, preserveUnneeded);
    processOperations(schema, parentSchema, sourceSchemas);

    return schema;
}

/*
 * The schemaKeys we get are often of the form /some-name.json. Some of the characters that show up there can not be
 * used as a Javascript identifier, and so we modify the above into a Javascript compatible form. For example the
 * above would become some_name.
 */
function schemaKeyToTypeName(schemaKey, schemas) {
    if (!schemas[schemaKey]) {
        dxLog.fail('Could not find a schema entry for ' + schemaKey);
    }

    if (schemas[schemaKey].name) {
        return schemas[schemaKey].name;
    }

    var newString = schemaKey.replace(/\.json$/, '')
        .replace(/-/g, '_')
        .replace(/\//g, '');

    return newString;
}

/*
 * Process the properties. As far as this is concerned, properties are one of:
 * A simple primitive value
 *     propertyName: {
 *         type: string|number|integer|boolean|null,
 *         [default: value]
 *     }
 *  or a simple object
 *     propertyName: {
 *         type: object
 *     }
 *  or an 'embedded object'
 *     propertyName: {
 *         type: object,
 *         $ref: schemaKey
 *     }
 *  or a 'referenced object'
 *     propertyName: {
 *         type: string,
 *         format: objectReference,
 *         [referenceTo: schemaKey]
 *     }
 *  or an array
 *     propertyName: {
 *         type: array,
 *         [items: {
 *             type: string|number|integer|boolean|null|object,
 *             [$ref: schemaKey]
 *         }]
 *     }
 *  note: $ref may only present if the type is object.
 * Also the type can be an array of any of the things above.
 *
 * Any one of these may also have these values:
 *         [create: required|optional|readonly,]
 *         [update: required|optional|readonly,]
 *         [required: true|false]
 * Note that there are many other validation related properties, but they are not altered by this processing.
 *
 * This does two things:
 *  1) provides 'property inheritance' by copying the parent's properties (if any) and replacing them as appropriate
 *     with this schema's properties.
 *  2) Replaces any references to schema types with the type name of the target types.
 */
function processProperties(schema, parentSchema, sourceSchemas, preserveUnneeded) {
    if (!schema.properties && !(parentSchema && parentSchema.properties)) {
        return;
    }

    var parentProps = (parentSchema && parentSchema.properties) ? _.clone(parentSchema.properties) : {};
    var propKeys = _.keys(schema.properties || {});
    schema.properties = _.extend(schema.properties || {}, _.omit(parentProps, propKeys));

    // Modify any of the schemas own properties
    _.each(propKeys, function(propName) {
        var propData = schema.properties[propName];

        convertTypeReference(propData, sourceSchemas);

        if (!preserveUnneeded) {
            delete propData.description;
        }
    });
}

/*
 * Process all operations. these look like the following:
 *     operations: {
 *         operationName: { ... details ... },
 *         ...
 *     }
 * or
 *     rootOperations: {
 *         operationName: { ... details ... },
 *         ...
 *     }
 * or one of the following
 *     create: { ... details ... }
 *     read: { ... details ... }
 *     list: { ... details ... }
 *     update: { ... details ... }
 *     delete: { ... details ... }
 *
 * This makes the following changes to these schemas:
 *  1) Schemas that are extensions of a root schema will inherit their parents' operations
 *  2) Standard operations update, delete and read are propogated down to child objects. List and create are not
 */
function processOperations(schema, parentSchema, sourceSchemas) {
    // Do some schema validation
    var schemaOps = _.pick(schema, ['operations', 'rootOperations', 'create', 'read', 'list', 'update', 'delete']);
    if (!schema.root && !_.isEmpty(schemaOps)) {
        dxLog.fail('Found ' + _.keys(schemaOps) + ' on a non-root schema.');
    }

    if (schema.operations && parentSchema && parentSchema.operations) {
        dxLog.fail('Both ' + parentSchema.name + ' and ' + schema.name + ' have operations. This isn\'t supported.');
    }

    var parentOps = (parentSchema && parentSchema.operations) ? parentSchema.operations : {};
    var opKeys = schema.operations ? _.keys(schema.operations) : [];
    var myOperations = _.extend(schema.operations || {}, _.omit(parentOps, opKeys));

    if (!_.isEmpty(myOperations)) {
        schema.operations = myOperations;

        _.each(opKeys, function(opName) {
            processOperation(schema.operations[opName], opName, sourceSchemas);
        });
    }

    _.each(schema.rootOperations, function(opInfo, opName) {
        processOperation(opInfo, opName, sourceSchemas);
    });

    var pSchema = parentSchema || {};
    _.each(['create', 'update', 'read', 'list', 'delete'], function(opName) {
        var opDef = schema[opName];
        if (!util.isNone(opDef)) {
            if (opName === 'create' || opName === 'update') {
               opDef.validateAs = opDef.validateAs || opName;
            }

            processOperation(opDef, opName, sourceSchemas);
        }

        if (opName !== 'create' && opName !== 'list') {
            schema[opName] = opDef || pSchema[opName];
        }
    });
}

/*
 * Process each operation. This generalizes across standard, object and root operations. These are expected to be of
 * the form:
 *     operationName: {
 *         payload: {
 *             [type: 'object',
 *             $ref: url-to-type]
 *         }
 *         [validateAs: create|update]
 *         [required: true|false]
 *         [return: ...]
 *     }
 * or
 *     operationName: {
 *         parameters: {
 *             ...
 *         }
 *         [return: ...]
 *     }
 * or the following, which means a GET with no parameters
 *     operationName: {
 *     }
 * Any one of those may have a 'sub-operation' of the same form (though, the last, with neither payload nor
 * parameters defined will be recognized, simply because it is ambiguous with other entries).
 *         subOpName: {
 *             payload: {...},
 *             [validateAs: create|update]
 *             [return: ...]
 *          }
 * or
 *         subOpName: {
 *             parameters: {...},
 *             [return: ...]
 *          }
 * The parameters are expected to be one of the following forms:
 *     paramName: {
 *         type: typeName,
 *         [format: formatValue],
 *         [enum: [values...]],
 *         [default: defaultValue]
 *         [required: true|false]
 *     }
 * or
 *     paramName: {
 *         type: 'string',
 *         format: 'objectReference',
 *         referenceTo: schemaKey
 *         [required: true|false]
 *     }
 * While, the return value is expected to be one of the following:
 *     return : {
 *        type: typeName,
 *         [format: formatValue]
 *     }
 * or
 *     return : {
 *        type: typeName,
 *         [$ref: schemaKey]
 *     }
 * or
 *     return : {
 *        type: 'array',
 *         [items: {
 *             $ref: schemaKey
 *         }]
 *     }
 * or
 *     return : {
 *        type: 'array',
 *         [items: {
 *             referenceTo: schemaKey
 *         }]
 *     }
 * These will be modified in these ways:
 *  1) $ref and referenceTo's will be set to type name of the relevant schemas
 *  2) Any sub-operation is extracted from its default location, and put into a sub-object called dxOperations
 *  3) in the case of a 'missing' parameters, an empty one will be inserted.
 *  4) Any $ref in the return value or the return.items value will be replaced with the type name of the schema.
 * Thus, we get:
 * {
 *     payload: {
 *         ...payload properties...
 *         $ref: <related schema>
 *     }
 *     validateAs: create|update,
 *     [dxOperations: {
 *         // sub-operations
 *     }]
 * }
 * or
 * {
 *     parameters: {
 *         ... parameters info, with any referenceTo's set to the actual related schema ...
 *     },
 *     [dxOperations: {
 *         // sub-operations
 *     }]
 * }
 */
function processOperation(opDef, opName, sourceSchemas) {
    if (opDef.payload) {
        if (opDef.parameters) {
            dxLog.fail('Found both a payload and a parameters for the operation ' + opName + '.');
        }
        if (opDef.payload.$ref) {
            opDef.payload.$ref = schemaKeyToTypeName(opDef.payload.$ref, sourceSchemas);
        }
    } else {
        opDef.parameters = opDef.parameters || {};

        _.each(opDef.parameters, function(value) {
            if (value.referenceTo) {
                value.referenceTo = schemaKeyToTypeName(value.referenceTo, sourceSchemas);
            }
        });
    }

    if (opDef.return) {
        convertTypeReference(opDef.return, sourceSchemas);
    }

    // Move any sub-operations into a sub-object
    _.each(opDef, function(value, key) {
        if (key === 'payload' || key === 'parameters') {
            return;
        }
        if (value.payload || value.parameters) {
            opDef.dxOperations = opDef.dxOperations || {};
            opDef.dxOperations[key] = processOperation(value, opName + '.' + key, sourceSchemas);
            delete opDef[key];
        }
    });

    return opDef;
}

/*
 * Given a type reference (a property type definition, or a return value definition), convert any references to
 * schema types from schemaKey format to the actual type name.
 */
function convertTypeReference(propData, sourceSchemas) {
    function convertReferences(type, propData) {
        if (type === 'array' && _.has(propData, 'items')) {
            if (_.has(propData.items, '$ref')) {
                propData.items.$ref = schemaKeyToTypeName(propData.items.$ref, sourceSchemas);
            } else if (_.has(propData.items, 'referenceTo')) {
                propData.items.referenceTo = schemaKeyToTypeName(propData.items.referenceTo, sourceSchemas);
            }
        }

        if (type === 'string' && propData.format === 'objectReference' && propData.referenceTo) {
            propData.referenceTo = schemaKeyToTypeName(propData.referenceTo, sourceSchemas);
        }

        if (type === 'object' && propData.$ref) {
            propData.$ref = schemaKeyToTypeName(propData.$ref, sourceSchemas);
        }
    }

    if (_.isArray(propData.type)) {
        _.each(propData.type, function(typeItem) {
            convertReferences(typeItem, propData);
        });
    } else {
        convertReferences(propData.type, propData);
    }
}

/*
 * Walk through each list operation, and add a dxFilterMode property to each. The values are:
 *    none: There are no query parameters, no filter is needed
 *    uber: Every parameter has a mapsTo property, so the uberFilter can be used
 *    custom: Not enough information. A custom filter will be needed.
 */
function markListOperations(schemas) {
    _.each(schemas, function(schema) {
        if (schema.list) {
            if (_.isEmpty(schema.list.parameters)) {
                schema.list.dxFilterMode = constant.LIST_TYPES.NONE;
            } else {
                var missingMapsTo = false;
                _.any(schema.list.parameters, function(param) {
                    if (!param.mapsTo) {
                        missingMapsTo = true;
                        return true;
                    }
                });
                schema.list.dxFilterMode = missingMapsTo ? constant.LIST_TYPES.CUSTOM :
                    constant.LIST_TYPES.UBER;
            }
        }
    });
}

/*
 * Given a set of schemas, modify them so that they are more easily consumable by other layers of the data system.
 *
 * Specifically, this expects the schemas to come in the form:
 * {
 *     'schemaKey': {
 *        [name: typeName,]
 *        [singleton: true|false,]
 *        [extends: { $ref: 'schemaKey' },]
 *        [root: 'url-fragment',]
 *        [properties: {...},]
 *        [create: {...},]
 *        [read: {...},]
 *        [list: {...},]
 *        [update: {...},]
 *        [delete: {...},]
 *        [operations: {...},]
 *        [rootOperations: {...}]
 *     },
 *     ...
 * }
 * Each schema may include other properties, but this will ignore them.
 *
 * The return value from this routine is a new version of the schemas, with modifications as discussed in each section
 * below.
 *
 * schemas:               The set of schemas to be prepared.  This is the only parameter that must be provided.
 * copySchemas:           If truthy, this will make a copy of the provided schemas before making changes to them.
 *                        Otherwise the original schema objects will be altered.
 * preserveUnneeded:      If truthy, properties like 'description' that aren't needed will not be deleted.
 */
function prepareSchemas(schemas, copySchemas, preserveUnneeded) {
    var newSchemas = {};

    if (!_.isObject(schemas)) {
        dxLog.fail('Must provide a schemas object.');
    }

    // Always copy the schemas at this time, as it caused model-generator to be unhappy.
    if (copySchemas || true) {
        schemas = util.deepClone(schemas);
    }

    _.each(schemas, function(value, key) {
        processSchema(value, key, schemas, newSchemas, preserveUnneeded);
    });
    
    /*
     * Finally, add a flag to each list operation to determine whether it can be generically filtered, or whether
     * it needs help
     */
    markListOperations(newSchemas);

    return newSchemas;
}

/*
 * Given a set of prepared schemas, this will find enums that are properties of a type and enums that are defined as
 * parameters of list, object, and root operations.  The expected input format of the prepared schemas is as follows:
 *
 *  {
 *      typeName: {
 *          [properties: {
 *              propertyName: {
 *                  enum: [value, ...]
 *              },
 *              arrayPropertyName: {
 *                  items: {
 *                      enum: [value, ...]
 *                  }
 *              }
 *          },]
 *          [list: {
 *              parameters: {
 *                  parameterName: {
 *                      enum: [value, ...]
 *                  }
 *              }
 *          },]
 *          [rootOperations|operations: {
 *              operationName: {
 *                  parameters: {...}
 *              }
 *          }]
 *      }
 *  }
 *
 * No specific types, properties or parameters are required, and excess properties will be ignored.  The output is an
 * object where each type and its enums can be accessed as properties:
 *
 *  {
 *      typeName: {
 *          (property|operation)Name: {
 *              value: value
 *              ...
 *          }
 *      }
 *  }
 *
 */
function prepareEnums(schemas) {
    var enums = {};

    if (!_.isObject(schemas)) {
        dxLog.fail('Must provide a set of prepared schemas.');
    }

    function processEnum(type, name, definition) {
        var enumType = enums[type] = enums[type] || {};
        var enumProp = enumType[name] = enumType[name] || {};
        _.each(definition.enum, function(enumVal) {
            enumProp[enumVal] = enumVal;
        });
    }

    function processParameters(type, opDef) {
        _.each(opDef.parameters, function(paramDef, paramName) {
            if (paramDef.enum) {
                processEnum(type, paramName, paramDef);
            }
        });
    }

    _.each(schemas, function(schema, type) {
        _.each(schema.properties, function(propDef, propName) {
            if (propDef.enum) {
                processEnum(type, propName, propDef);
            // Array of enums
            } else if (propDef.items && propDef.items.enum) {
                processEnum(type, propName, propDef.items);
            }
        });

        // Collect enums from list, root operation, and object operation parameters
        if (schema.list) {
            processParameters(type, schema.list);
        }
        _.each(schema.rootOperations, function(rootOpDef) {
            processParameters(type, rootOpDef);
        });
        _.each(schema.operations, function(opDef) {
            processParameters(type, opDef);
        });
    });

    return enums;
}

module.exports = {
    prepareSchemas: prepareSchemas,
    prepareEnums: prepareEnums
};

},{"../util/constant.js":16,"../util/util.js":17,"dxLog":"dxLog","underscore":"underscore"}],3:[function(require,module,exports){
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

var _ = require('underscore');
var Backgone = require('Backbone');
var dxLog = require('dxLog');
var util = require('../util/util.js');

function dumpEventListners(eventLadenObject) {
    var functionNameRegEx = /.*function *([^ \(]*) *\(/;
    _.each(eventLadenObject._events, function(listenerArray, eventName) {
        var anonymousCount = 0;
        var callbackNames = _.reduce(listenerArray, function(memo, item) {
            if (item.callback) {
                var functionString = item.callback.toString();
                var functionName = functionString.match(functionNameRegEx);
                if (functionName && functionName[1] !== '') {
                    memo.push(functionName[1]);
                } else {
                    anonymousCount++;
                }
            }
            return memo;
        }, []);

        // Don't show the internal callbacks used by this cache to mange the models. These never affect prune().
        if (callbackNames.length === 1 &&
            (eventName === 'badReference' && callbackNames[0] === 'handle404' ||
            eventName === 'change' && callbackNames[0] === 'updateCollections')) {
            return;
        }
        var suffix = callbackNames.length === 0 ? '' : '. ' + callbackNames.join(',');
        if (anonymousCount > 0) {
            suffix += ' (' + anonymousCount + ' anonymous)';
        }
        dxLog.info('   ' + eventName + ' : ' + listenerArray.length + ' callbacks' + suffix);
    });
}

/*
 * A simple cache of subscribers (collections or notification listeners).  Note that these are stored by the type that
 * the list operation for the specified type returns, which in some cases is different than the specified type.
 * This is a private type, so it does no checking of arguments.
 */
function ModelSubscriberStore() {
    var modelSubscribersByType = {};

    function forEachSubscription(functionToApply) {
        _.each(modelSubscribersByType, function(subscriber) {
            _.each(subscriber, functionToApply);
        });
    }

    function add(subscriber) {
        var baseType = subscriber._dxInfo.baseType;
        modelSubscribersByType[baseType] = modelSubscribersByType[baseType] || [];

        if (modelSubscribersByType[baseType].indexOf(subscriber) === -1) {
            modelSubscribersByType[baseType].push(subscriber);
        }
    }

    function remove(subscriber) {
        var baseType = subscriber._dxInfo.baseType;
        var index = modelSubscribersByType[baseType].indexOf(subscriber);
        if (index !== -1) {
            if (subscriber instanceof Backbone.Collection) {
                subscriber.clear();
            }
            modelSubscribersByType[baseType].splice(index, 1);

            if (_.isEmpty(modelSubscribersByType[baseType])) {
                delete modelSubscribersByType[baseType];
            }
        }
    }

    function hasType(typeName) {
        return !!modelSubscribersByType[typeName];
    }

    function getAllOfType(typeName) {
        return modelSubscribersByType[typeName] || [];
    }

    /*
     * Forcibly empty all collections in the store, and then remove all subscribers
     */
    function reset() {
        var toRemove = [];

        // accumulate the items to remove
        forEachSubscription(function(subscriber) {
            toRemove.push(subscriber);
        });

        // now remove them (removing while accumulating can mess up the loops)
        _.each(toRemove, remove);
    }

    /*
     * Remove all subscribers that have no more listeners
     */
    function prune() {
        var toRemove = [];

        forEachSubscription(function(subscriber) {
            if (subscriber instanceof Backbone.Collection) {
                if (_.isEmpty(subscriber._events)) {
                    toRemove.push(subscriber);
                }
            } else if (!subscriber.inUse) {
                // it is a creation Listener
                toRemove.push(subscriber);
            }
        });

        _.each(toRemove, remove);
    }

    /*
     * Returns:
     *    true: If the store has no subscribers
     *    false: if the store has one or more subscribers
     */
    function isEmpty() {
        return _.isEmpty(modelSubscribersByType);
    }

    /*
     * Write out the subscribers.
     */
    function dump() {
        dxLog.info('SUBSCRIBERS');
        dxLog.info('===========');
        dxLog.info(modelSubscribersByType);
    }

    function dumpText() {
        dxLog.info('SUBSCRIBERS');
        dxLog.info('===========');
        if (_.isEmpty(modelSubscribersByType)) {
            dxLog.info('None.');
        }
        var types = _.keys(modelSubscribersByType);
        _.each(types.sort(), function(typeName) {
            dxLog.info(typeName);
            dxLog.info('-------------');
            _.each(modelSubscribersByType[typeName], function(subscriber) {
                if (subscriber instanceof Backbone.Collection) {
                    var collection = subscriber;
                    var references = collection.reduce(function(memo, item) {
                        if (item.id) {
                            memo.push(item.id);
                        }
                        return memo;
                    }, []);

                    var suffix = references.length === 0 ? '' :  '. IDs: ' + references.join(', ');
                    dxLog.info('   ' + collection.length + ' model collection' + suffix);
                    dumpEventListners(collection);
                } else {
                    var qp = subscriber.getQueryParameters();
                    dxLog.info('Notification Listener with query params: ' + (qp ? JSON.stringify(qp) : 'None'));
                }
            });
        });
    }

    return {
        _modelSubscribers: modelSubscribersByType,
        add: add,
        remove: remove,
        hasType: hasType,
        getAllOfType: getAllOfType,
        reset: reset,
        dump: dump,
        prune: prune,
        isEmpty: isEmpty,
        dumpText: dumpText
    };
}

/*
 * A simple cache of singletons.  This is a private type, so it does no checking of arguments.
 */
function SingletonStore() {
    var singletons = {};

    function add(singleton) {
        singletons[singleton.get('type')] = singleton;
    }

    function get(typeName) {
        return singletons[typeName];
    }

    function remove(singleton) {
        if (!_.isUndefined(singletons[singleton.get('type')])) {
            delete singletons[singleton.get('type')];
        }
    }

    function hasType(typeName) {
        return !!singletons[typeName];
    }

    /*
     * Forcibly remove all singletons
     */
    function reset() {
        _.each(_.keys(singletons), function(typeName) {
            delete singletons[typeName];
        });
    }

    /*
     * Remove all singletons that have no more listeners
     */
    function prune() {
        var toRemove = _.filter(singletons, function(singleton) {
            return _.isEmpty(singleton._events);
        });

        _.each(toRemove, function(model) {
            delete singletons[model.get('type')];
        });
    }

    /*
     * Returns:
     *    true: If the store has no singletons
     *    false: if the store has one or more singletons
     */
    function isEmpty() {
        return _.isEmpty(singletons);
    }

    /*
     * Write out the singletons.
     */
    function dump() {
        dxLog.info('SINGLETONS');
        dxLog.info('==========');
        dxLog.info(singletons);
    }

    function dumpText() {
        dxLog.info('SINGLETONS');
        dxLog.info('==========');
        if (_.isEmpty(singletons)) {
            dxLog.info('None.');
        }
        _.each(singletons, function(singleton, typeName) {
            dxLog.info(typeName);
            dumpEventListners(singleton);
        });
    }

    return {
        _singletons: singletons,
        add: add,
        get: get,
        remove: remove,
        hasType: hasType,
        reset: reset,
        dump: dump,
        prune: prune,
        isEmpty: isEmpty,
        dumpText: dumpText
    };
}

/*
 * A simple cache of models.  These are organized by root type, then reference. This is a private type, so it does no
 * signifianct checking of arguments.
 */
function ModelStore(context) {
    var modelsByTypeThenRef = {};

    function forEachModel(functionToApply) {
        _.each(modelsByTypeThenRef, function(models) {
            _.each(models, functionToApply);
        });
    }

    function add(model) {
        var rootType = context._getRootType(model.get('type'));
        var reference = model.get('reference');
        modelsByTypeThenRef[rootType] = modelsByTypeThenRef[rootType] || {};

        if (util.isNone(reference)) {
            dxLog.fail('Can not cache a model with no reference (type is: ' + model.get('type') + ').');
        }

        modelsByTypeThenRef[rootType][reference] = model;
    }

    // typeName is optional
    function get(reference, typeName) {
        if (_.isUndefined(typeName)) {
            var result;
            _.find(modelsByTypeThenRef, function(models) {
                return _.find(models, function(model, modelReference) {
                    if (modelReference === reference) {
                        result = model;
                        return true;
                    }
                });
            });
            return result;
        } else {
            return modelsByTypeThenRef[typeName] ? modelsByTypeThenRef[typeName][reference] : undefined;
        }
    }

    function remove(model) {
        var rootType = context._getRootType(model.get('type'));
        var reference = model.get('reference');
        modelsByTypeThenRef[rootType] = modelsByTypeThenRef[rootType] || [];
        model.off(undefined, undefined, context);

        delete modelsByTypeThenRef[rootType][reference];

        if (_.isEmpty(modelsByTypeThenRef[rootType])) {
            delete modelsByTypeThenRef[rootType];
        }
    }

    function hasModel(reference) {
        return !!get(reference);
    }

    /*
     * Forcibly remove all models
     */
    function reset() {
        var toRemove = [];

        forEachModel(function(model) {
            toRemove.push(model);
        });

        _.each(toRemove, remove);
    }

    /*
     * Remove all models that have no more listeners
     */
    function prune() {
        var toRemove = {};

        forEachModel(function(model, reference) {
            var events = model._events || {};
            /*
             * Our model creation system currently sets up listeners on badReference and change.  If a model has
             * only one listener for each event, we want to ignore them when we consider whether the model has any
             * listeners that should prevent it from being pruned. (we don't mind pruning something that only has
             * listeners set up by the model creation system)
             */
            var hasCachingListeners = events.badReference && events.badReference.length === 1 &&
                events.change && events.change.length === 1;
            var listeners = hasCachingListeners ? _.omit(events, ['badReference', 'change']) : events;

            if (_.isEmpty(listeners)) {
                toRemove[reference] = model;
            }
        });

        _.each(toRemove, remove);
    }

    /*
     * Returns:
     *    true: If the store has no models
     *    false: if the store has one or more models
     */
    function isEmpty() {
        return _.isEmpty(modelsByTypeThenRef);
    }

    /*
     * Write out the models.
     */
    function dump() {
        dxLog.info('SERVER MODELS');
        dxLog.info('=============');
        dxLog.info(modelsByTypeThenRef);
    }

    function dumpText() {
        dxLog.info('SERVER MODELS');
        dxLog.info('=============');
        if (_.isEmpty(modelsByTypeThenRef)) {
            dxLog.info('None.');
        }
        var types = _.keys(modelsByTypeThenRef);
        _.each(types.sort(), function(typeName) {
            dxLog.info(typeName);
            dxLog.info('-------------');
            var references = _.keys(modelsByTypeThenRef[typeName]);
            _.each(references.sort(), function(reference) {
                var model = modelsByTypeThenRef[typeName][reference];
                dxLog.info(reference);
                dumpEventListners(model);
            });
        });
    }

    return {
        _models: modelsByTypeThenRef,
        add: add,
        get: get,
        remove: remove,
        hasModel: hasModel,
        reset: reset,
        dump: dump,
        prune: prune,
        isEmpty: isEmpty,
        dumpText: dumpText
    };
}

/*
 * This portion of the data system provides a cache of models and subscribers, collections and notification listeners.
 * It ensures that models are unique (that is, there is only one instance for a particular reference), it makes sure
 * all collections contain the models that they legitimately could contain, and subscribers are notified of new
 * models.
 *
 * There are four primary uses:
 *   - Someone retrieves data from the server. It would call getCachedModelFromProperties() which will create or update
 *     a model using those properties, and return the model to the caller.
 *   - Someone wants to retrieve a particular model. It calls getCachedModel(), which returns the requested model (and
 *     does a fetch on it, if necessary)
 *   - Someone wants to get a singleton: so it calls getCachedSingleton() which returns the unique singleton instance.
 *   - Someone wants a collection or notification subscribers of a particular type. They create the data structure
 *     and call _modelSubscribersStore.add to make sure the subscribers gets notified of changes and collections
 *     updated.
 *
 * This entire cache system is 'private' to the data system, and should not be called from outside.
 *
 * Unless reset() is called, at this time models and collections are never discarded.
 *
 * As with other parts of the data system, this takes a 'context' object, and attaches a _cache object to that one,
 * where private (to the data system) caching routines reside. The intent here is to make sure that if needed multiple
 * data systems can co-exist.
 */
function initCache(context) {
    /*
     * Return a singleton of the specified type. If it doesn't already exist, a new model is created, cached, and
     * returned.  If 'update' is true, then this will fetch new data for the model.
     * typeName:   The type of the singleton
     * options:    JSON object with these optional properties:
     *               update: {true|false}  Will cause an update (fetch) on the model
     *               success: A function to call when the model is ready
     *               error: A function to call when an error occurred during a fetch
     */
    function getCachedSingleton(typeName, options) {
        if (!_.isString(typeName)) {
            dxLog.fail('A type name must be passed to get the singleton.');
        }
        options = options || {};
        var model;
        var isNew;
        if (context._singletonStore.hasType(typeName)) {
            model = context._singletonStore.get(typeName);
            if (options.success) {
                options.success(model);
            }
        } else {
            var schema = assertTypeAndGetModelSchema(typeName);

            if (!schema.singleton) {
                dxLog.fail(typeName + ' is not a singleton.');
            }

            model = context._newServerModel(typeName);
            context._singletonStore.add(model);
            isNew = true;
        }

        if (options.update || isNew) {
            var fetchOpts = options;
            if (isNew) {
                fetchOpts = {
                    success: options.success,
                    error: function(result) {
                        context._singletonStore.remove(model);
                        if (options.error) {
                            options.error(result);
                        } else if (!options.suppressDefaultErrorHandler) {
                            context.reportErrorResult(result);
                        }
                    }
                };
            }
            model._dxFetch(fetchOpts);
        }

        return model;
    }

    /*
     * Given a set of properties, either update an existing model with the same reference as in the properties
     * object, or create a new server model, populate it with these properties, cache it and return it.
     *
     * properties: A JSON object containing properties that can be set() on a DSB model
     * options:    Backbone options
     */
    function getCachedModelFromProperties(properties, options) {
        var model;

        if (!_.isObject(properties) || !_.isString(properties.type)) {
            dxLog.fail('Must be called with an object that has a type property that is a string value.');
        }

        if (!context._modelConstructors[properties.type]) {
            dxLog.fail('Don\'t know how to create a model of type ' + properties.type + '.');
        }

        // Not all types have a reference property. Those that do not are not cachable. Assume this is a client model
        if (!isTypeCachable(properties.type) || util.isNone(properties.reference)) {
            model = context._newClientModel(properties.type);
            model._dxSet(properties);
            return model;
        }

        var rootType = context._getRootType(properties.type);
        model = context._modelStore.get(properties.reference, rootType);
        if (_.isUndefined(model)) {
            model = makeModel(properties, properties.type, rootType);
            model._dxMakeReady();
            addModel(model, rootType, options);
        } else {
            model._dxSet(properties);
        }

        return model;
    }

    /*
     * Returns a cached model with the specified reference.  If the model isn't in the cache, this will return
     * a new model, which it will also fetch. If the update argument is true, it will be
     * fetched regardless of whether it is new or old.
     *
     * reference:  The reference of the model to retrieve
     * typeName:   The type of the model @@@@ why isn't this the root type?
     * options:    JSON object with these optional properties:
     *               update: {true|false}  Will cause an update (fetch) on the model
     *               cacheOnlyIfNeeded: {true|false} Add to the cache (and return) only if there are already
     *                  collections that would use it.
     *               suppressDefaultErrorHandler: {true|false} Do not trigger the default error handler on dxFetch
     */
    function getCachedModel(reference, typeName, options) {
        if (!_.isString(reference) || !_.isString(typeName)) {
            dxLog.fail('A reference and a type must be passed to get the model.');
        }
        options = options || {};

        var isNew = false;
        var rootType = context._getRootType(typeName);
        var mustCache = !options.cacheOnlyIfNeeded;
        var haveSubscriptionWhichNeedsModel = (context._modelSubscribersStore.getAllOfType(rootType).length !== 0);
        var addToCache = mustCache || haveSubscriptionWhichNeedsModel;

        var model = context._modelStore.get(reference, rootType);
        if (_.isUndefined(model) && addToCache) {
            model = makeModel({ reference: reference }, typeName, rootType);
            isNew = true;
        }

        if (model && (options.update || isNew)) {
            model._dxFetch({
                success: function() {
                    if (isNew) {
                        addModel(model, rootType);
                    }
                },
                error: function(result) {
                    if (isNew) {
                        context._modelStore.remove(model);
                    }
                    if (!options || !options.suppressDefaultErrorHandler) {
                        context.reportErrorResult(result);
                    }
                }
            });
        }

        return model;
    }

    /*
     * Returns true if the cache contains a model with the specified reference
     */
    function containsCachedModel(reference, typeName) {
        if (!_.isString(reference) || !_.isString(typeName)) {
            dxLog.fail('A reference and a type must be passed to check on the model.');
        }

        return !_.isUndefined(context._modelStore.get(reference, context._getRootType(typeName)));
    }

    /*
     * Deletes the model. This means removing it from the cache, as well as from any
     * collections that contain it, and clears the model's properties.
     * If the dontTriggerDelete flag is not set, this will also trigger a 'delete' event on the model.
     */
    function deleteCachedModel(reference, typeName, dontTriggerDelete) {
        if (!_.isString(reference) || !_.isString(typeName)) {
            dxLog.fail('A reference and a type must be passed to delete a model.');
        }

        var rootType = context._getRootType(typeName);
        var doomed = context._modelStore.get(reference, rootType);
        if (!doomed) {
            return;
        }

        _.each(context._modelSubscribersStore.getAllOfType(rootType), function(subscriber) {
            if (subscriber instanceof Backbone.Collection) {
                subscriber._dxRemoveModel(doomed);
            }
        });

        if (!dontTriggerDelete) {
            doomed.trigger('delete', doomed);
        }
        doomed.off(null, null, context);
        context._modelStore.remove(doomed);
        doomed._dxClear();
        doomed._dxDeleted = true;
    }

    /*
     * Remove all references we have to both singletons and server models.
     */
    function resetCache() {
        context._modelSubscribersStore.reset();
        context._singletonStore.reset();
        context._modelStore.reset();
    }

    /*
     * Dump the types (for singletons) and references (for server models) as text for all objects in the cache.
     */
    function dumpCacheAsText() {
        context._modelSubscribersStore.dumpText();
        dxLog.info('');

        context._singletonStore.dumpText();
        dxLog.info('');

        context._modelStore.dumpText();
    }

    /*
     * Dump the internal singletons and model data structures.  This is usable on most browsers.
     */
    function dumpCache() {
        context._modelSubscribersStore.dump();
        dxLog.info('');

        context._singletonStore.dump();
        dxLog.info('');

        context._modelStore.dump();
        dxLog.info('');
    }

    function prune() {
        context._modelSubscribersStore.prune();
        context._singletonStore.prune();
        context._modelStore.prune();
    }

    function isEmpty() {
        return context._modelSubscribersStore.isEmpty() &&
            context._singletonStore.isEmpty() &&
            context._modelStore.isEmpty();
    }

    /*
     * Creates a model, sticks it in the cache, and sets up to cope with badReferences
     */
    function makeModel(properties, typeName, rootType) {
        var model = context._newServerModel(typeName);
        model._dxSet(properties);
        context._modelStore.add(model);
        model.on('badReference', function handle404() {
            deleteCachedModel(properties.reference, rootType, true);
        }, context);

        return model;
    }

    /*
     * Adds the specified model to the collections
     */
    function addModel(model, rootType, options) {
        /*
         * Recheck whether the model should be added to collections any time it changes.
         * This does not apply for subscribers which only need to be notified once for each object.
         */
        model.on('change', function updateCollections() {
            notifySubscriptionsOfModelChanged(model, rootType);
        }, context);
        notifySubscriptionsOfModel(model, rootType, options);
    }

    /*
     * Adds the specified model to all relevant subscribers (collections or notification listeners).
     */
    function notifySubscriptionsOfModel(model, rootType, options) {
        _.each(context._modelSubscribersStore.getAllOfType(rootType), function(subscriber) {
            subscriber._dxAddOrRemove(model, options);
        });
    }

    /*
     * Notifies collections that the model has changed.
     */
    function notifySubscriptionsOfModelChanged(model, rootType, options) {
        _.each(context._modelSubscribersStore.getAllOfType(rootType), function(subscriber) {
            if (subscriber instanceof Backbone.Collection) {
                subscriber._dxAddOrRemove(model, options);
            }
        });
    }

    /*
     * Asserts that the type is a valid model type, and returns its schema.
     */
    function assertTypeAndGetModelSchema(typeName) {
        var ModelConstructor = context._modelConstructors[typeName];

        if (!ModelConstructor) {
            dxLog.fail(typeName + ' is not a known type name.');
        }

        return ModelConstructor.prototype._dxSchema;
    }

    /*
     * Examines the type, and returns a truthy value if it is cachable
     */
    function isTypeCachable(type) {
        var Constructor = context._modelConstructors[type];
        if (!Constructor) {
            return false;
        }
        var typeDef = Constructor.prototype._dxSchema;
        var propDefs = typeDef.properties || {};

        return !!propDefs.reference;
    }

    context._modelSubscribersStore = new ModelSubscriberStore();
    context._singletonStore = new SingletonStore();
    context._modelStore = new ModelStore(context);

    /*
     * Make all of our public routines available.
     */
    context._cache = {
        _ModelSubscriberStore: ModelSubscriberStore,
        _SingletonStore: SingletonStore,
        _ModelStore: ModelStore,
        getCachedSingleton: getCachedSingleton,
        getCachedModelFromProperties: getCachedModelFromProperties,
        getCachedModel: getCachedModel,
        deleteCachedModel: deleteCachedModel,
        containsCachedModel: containsCachedModel,
        reset: resetCache,
        dumpText: dumpCacheAsText,
        dump: dumpCache,
        prune: prune,
        isEmpty: isEmpty,
        isTypeCachable: isTypeCachable
    };
};

module.exports = initCache;

},{"../util/util.js":17,"Backbone":1,"dxLog":"dxLog","underscore":"underscore"}],4:[function(require,module,exports){
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

/*global $ */

'use strict';

var _ = require('underscore');
var Backgone = require('Backbone');
var dxLog = require('dxLog');

var CONSTANT = require('../util/constant.js');
var util = require('../util/util.js');

/*
 * This takes a set of schemas (modified by _prepareSchemas), and creates a set of Backbone Collection constructor
 * functions (and, by implication, functionality upon the collections generated by those functions). These will be
 * used by the 'level3' API's to provide final collections to consumers of the data layer.
 *
 * See the comment for level2-models for a list of the specialized terminology used here (e.g. DSB).
 *
 * CONSTRUCTOR FUNCTIONS
 * The collections created by these constructor functions contain groups of DSB Models that all share a common parent
 * type.  These collections can only have their contents changed by way of $$list() operations and the notification
 * system. Unlike DSB models, there are no 'Client' collections.  To have a fully-alterable collection of models,
 * use an ordinary Backbone Collection.
 *
 * EVENTS
 * ready : readyHandler(collection)
 * If you want to know if a collection is ready to be used (has retrieved at least one set of results via $$list()),
 * use the 'ready' event, which is unique to DSB collections.
 * Ready indicates that the collection has retrieved an initial set of models.  Unlike ordinary events, if a ready
 * handler is assigned to a collection that is already ready, that handler (and no others) will be triggered
 * immediately. Ready handlers receive as their first (and only) argument the
 *
 * dirty : dirtyHandler(collection)
 * Indicates that the collection may be out of sync with the server and should be re-$$list()'ed
 *
 * POPULATION
 * Server collections are populated in two ways:
 *   1) A call to $$list() will fill the collection with the current set of models from the server
 *   2) The notification system, if enabled, may cause models to be added and removed from the collection at any time.
 * The operation of $$list() is straightforward.  Notifications are a little less clear.  As the notification system
 * learns of object changes, it will inform the caching system about the changes.  That, in turn will cause the
 * caching system to try to update any collections, adding and removing those models to collections as needed.
 * The decision of whether a model should be added will depend on the query parameters that currently govern the
 * collection (the ones last passed to $$list(), if any).  In some cases, a collection may have a paged set of results,
 * and at that point it can be difficult to determine whether the model should be added to the collection.
 * The filter system (level2-filter) provides per-type filters. It is their responsibility to determine how the model
 * should be dealt with. If it can't determine (as in the case with paging), the collection will trigger a 'dirty'
 * event, which the client of the collection can use to decide how to handle this case. If setAutoPageRefresh(true) has
 * been called on the collection, then in these circumstances, in addition to firing the 'dirty' event, the collection
 * will automatically re-call $$list() with the original query parameters. In this case, the original success and error
 * handlers will be called again after the list operation returns.
 *
 * OPERATIONS
 * The collections created by these constructor functions have these similarities and differences compared to the
 * standard Backbone collections.
 *
 * Standard Backbone properties (none of these should be changed)
 *     models     : -- : The set of models in the collection. Don't access directly. Use at() instead.
 *     length     :    : Standard behavior.
 *
 * Standard Backbone functions
 *     model      : -- : Must not use. Collections can not create their own models.
 *     toJSON     :    : Standard behavior.
 *     Underscore :    : Standard behavior. These are the 'underscore' functions can all be applied to collections.
 *     add        : -- : Do not use. Use $$list() instead.
 *     remove     : -- : Do not use. Use $$list() instead.
 *     reset      : -- : Do not use. Use $$list() instead.
 *     set        : -- : Do not use. Use $$list() instead.
 *     get        :    : Standard behavior.
 *     at         :    : Standard behavior.
 *     push       : -- : Do not use. Use $$list() instead.
 *     pop        : -- : Do not use. Use $$list() instead.
 *     unshift    : -- : Do not use. Use $$list() instead.
 *     shift      : -- : Do not use. Use $$list() instead.
 *     slice      :    : Standard behavior.
 *     comparator :    : Standard behavior.
 *     sort       :    : Standard behavior.
 *     pluck      :    : Standard behavior.
 *     where      :    : Standard behavior.
 *     findWhere  :    : Standard behavior.
 *     url        : -- : Internal use. Don't use.
 *     parse      : -- : Internal use. Don't use. Handles return values from the Delphix Engine
 *     clone      :    : Standard behavior. However, the returned collection is an ordinary Backbone Collection.
 *     fetch      : -- : Do not use. Use $$list() instead.
 *     create     : -- : Do not use. DSB Models have more complex creation semantics. use rootOps..$$create().
 *
 * DSB Collection functions
 *     $$list             :    : Populates the collection with a selection of models from the server.
 *     getQueryParameters :    : Returns the query parameters used to populate this collection via $$list
 *     clear              :    : Removes all models from the collection, empties any query parameters, and blocks any
 *                               models from being auto-added until another $$list is issued
 *
 * Private to dxCore Data
 *     context._collectionConstructors : The set of collection constructor functions
 *     context._newServerCollection    : Creates a new Server Collection
 *
 * Parameters:
 *     schemas: The set of schemas this should generate constructors from.
 *     context: The object to put the resulting constructors (_collectionConstructors) on. If not specified, puts them
 *              on 'this'.
 */
function generateCollectionConstructors(schemas, context) {
    var LISTINGMODE_IDLE = 0;
    var LISTINGMODE_LISTING = 1;

    /*
     * ========================================
     * Collection functions
     * ========================================
     */

    /*
     * Backbone defines this as: Bind a callback function to an object. The callback will be invoked whenever the event
     * is fired.
     *
     * For DSB collections, we provide standard behavior for this, but do some special processing if someone is
     * listening for the 'ready' event. In that case, if we have done a $$list() successfully, then we trigger the
     * ready event immediately.
     */
    function dxOn(name, callback, context) {
        Backbone.Events.on.call(this, name, callback, context);
        if (name === 'ready' && this._dxIsReady) {
            this.trigger('ready', this);
        } else if (name === 'error' && this._dxIsErrored) {
            this.trigger('error', this);
        }
    }

    /*
     * Backbone defines this as: [This] performs a 'smart' update of the collection with the passed list of models.
     *
     * In general, we do not allow this to be called, since server models are supposed to be read only. However,
     * in some cases, internally, we need to add models to the collection, and wish to partake of the functionality
     * already defined by Backbone. So, if this is called with { _dxAllowSetPassthrough:true }, it will call
     * Backbone.Collection.set() normally.
     *
     * This is not simply a dxAdd function, since we need to support calls from within backbone back to model.set()
     * that may have been triggered by other actions we have taken.
     */
    function dxSet(models, options) {
        options = options || {};
        if (!options._dxAllowSetPassthrough) {
            operationNotAllowed();
        }

        assertModelsCompatible(models, this);
        return Backbone.Collection.prototype.set.call(this, models, _.extend(options, {
            merge: false,
            remove: false
        }));
    }

    /*
     * Backbone defines this as: parse is called by Backbone whenever a collection's models are returned by the server,
     * in fetch. The function is passed the raw response object, and should return the array of model attributes to be
     * added to the collection. The default implementation is a no-op, simply passing through the JSON response.
     * Override this if you need to work with a preexisting API, or better namespace your responses.
     *
     * This expects the response to always have a type attribute. If it is an ErrorResult, it gets reported through the
     * standard error handler. If it is a ListResult, we return just the result array. Otherwise we throw an error.
     */
    function dxParse(response) {
        if (!response || !response.type) {
           dxLog.fail('Got a response without a type.');
        } else if (response.type !== 'ListResult') {
            dxLog.fail('Got an unexpected type of response (' + response.type + ') in parse().');
        }

        return response.result;
    }

    /*
     * Entirely block the standard Backbone fetch() routine. We want users to call $$list(), as that has a more
     * constrained API, better matches the api we're providing for operations and rootOperations, and, more directly
     * maps to our schemas.
     */
    function dxFetch() {
        dxLog.fail('Do not call fetch() directly. Instead, call $$list().');
    }

    /*
     * Entirely block the standard Backbone create() routine. Creation is more complex for DSB models, and so should be
     * done through the $$create operations.
     */
    function dxCreate() {
        dxLog.fail('Do not call create() directly. Instead, call rootOps.' + this._dxInfo.baseType + '.$$create().');
    }

    /*
     * Removes all models from the collection, but leaves it 'live'.  This is used for testing purposes.
     */
    function dxEmpty() {
        Backbone.Collection.prototype.remove.call(this, this.models, {silent: true});
    }

    /*
     * Removes all models from the collection (not silently), removes the query parameters,
     * if any, and marks the collection as not ready, which means it must have another $$list() call in order to get
     * new models
     */
    function dxClear() {
        this._dxIsReady = false;
        this._queryParameters = undefined;
        Backbone.Collection.prototype.remove.call(this, this.models, {silent: true});
        this.trigger('reset', this);
    }

    /*
     * Given a model, this will either add it to the collection, if it should be in the collection, ignore it if it
     * shouldn't be in the collection (and isn't there already), or remove it if it shouldn't be in the collection and
     * is.  This takes into account any query parameters associated with the collection, and uses collection filters
     * if defined.
     *
     * Note that models can be neither added nor removed if this is not ready.
     */
    function dxAddOrRemove(model, options) {
        assertModelsCompatible(model, this);
        if (!this._dxIsReady) {
            return;
        }
        options = _.extend({
                _dxAllowSetPassthrough: true
            }, options);
        var self = this;
        var rootType = this._dxInfo.baseType;

        if (self._listingMode === LISTINGMODE_LISTING) {
            return;
        }

        var filter = context._filters[rootType];
        if (!filter) {
            if (self._dxInfo.paramDefs.dxFilterMode === CONSTANT.LIST_TYPES.NONE) {
                dxSet.call(self, model, options);
                return;
            }

            filter = context._filters._uberFilter;
        }

        filter(this, model, function(placement) {
            if (model._dxDeleted) {
                /*
                 * Since some filters use asynchronous requests to determine the inclusion of an object,
                 * it is possible for an object to be deleted while a filter is executed.
                 * We need to make sure that even if the filter determines that the object should be
                 * included in the list, the collection discards deleted objects.
                 */
                return;
            }
            switch (placement) {
                case context._filters.INCLUDE:
                    dxSet.call(self, model, options);
                    break;
                case context._filters.EXCLUDE:
                    self._dxRemoveModel(model, options);
                    break;
                case context._filters.UNKNOWN:
                    if (self._listingMode === LISTINGMODE_IDLE) {
                        triggerDirty(self);
                    }
                    break;
                default:
                    dxLog.fail('Filter returned an invalid value.');
            }
        });
    }

    /*
     * Sets the autoPageRefresh property.
     */
    function setAutoPageRefresh(value) {
        this._autoPageRefresh = value;
    }

    /*
     * Return the autoPageRefresh property.
     */
    function getAutoPageRefresh() {
        return this._autoPageRefresh;
    }

    /*
     * Remove the models from this collection that are being obsoleted by the contents of the rawPropsArray. In
     * general, we remove the models that the collection currently contains that are not part of the rawPropsArray,
     * but if the rawPropsArray don't have a reference attribute, then we can't tell if the models are the same or not
     * so we reset.
     *
     * Return whether we are resetting the collection. This is true if we're removing all elements, or if
     * collection._resetOnList is true.
     */
    function removeUnneededModels(collection, rawPropsArray) {
        var resetting = false;

        if (rawPropsArray.length !== 0 && _.isUndefined(rawPropsArray[0].reference)) {
            Backbone.Collection.prototype.remove.call(collection, collection.models, {silent: true});
            resetting = true;
        } else {
            var newReferences = _.map(rawPropsArray, function(attributes) {
                return attributes.reference;
            });

            // Figure out which models to remove (by reference). reset if removing all
            var modelsToRemove = [];
            collection.each(function(model) {
                if (!_.contains(newReferences, model.id)) {
                    modelsToRemove.push(model);
                }
            });

            if (collection._resetOnList || modelsToRemove.length === collection.length) {
                resetting = true;
            }

            _.each(modelsToRemove, function(model) {
                Backbone.Collection.prototype.remove.call(collection, model, {silent: resetting});
            });
        }
        return resetting;
    }

    /*
     * Retrieve a set of models from the server, entirely replacing the contents of this collection with those models.
     * This is a reflection of the list standard operation found in Delphix schemas.  This takes a set of query
     * parameters as an argument, and will populate the collection with the results of that query.
     *
     * Note that if multiple requests are issued, this will only honor the last request sent. Models are added/removed
     * only when the last issued request returns. This also means that ready/error events are triggered and promises
     * resolved/rejected only once the last request issued returns.
     *
     * Parameters:
     *     parameters: An object hash containing the parameters to this list operation. For example, if this is a
     *         Container collection, you might call
     *             myCollection.$$list({
     *                 group: 'GROUP-1',
     *                 parent: 'CONTAINER-23'
     *             });
     *     successError: A standard object that contains a success and/or error callback routine.
     * Events:
     *     ready:  Triggered for the collection once all the models have been added and removed. Handler argument is
     *             the collection.
     *             Also triggered for each model marked as ready. Handler argument is a model.
     *     reset:  Triggered if this results in all the existing models being removed, or the _resetOnList flag has
     *             been set to true. Argument is the collection.
     *     remove: Triggered for each model removed, iff only some of the models are removed. Argument is the model.
     *     add:    Triggered for each added model, iff only some of the models were removed. Argument is the model.
     */
    function dxList(parameters, successError) {
        var sendableParams = context._checkAndConvertParameters(parameters, this._dxInfo.paramDefs.parameters);
        var self = this;
        var rootType = this._dxInfo.baseType;

        // No filter function. Complain so someone writes one, and blindly add the model
        if (util.isNone(context._filters[rootType]) &&
            self._dxInfo.paramDefs.dxFilterMode === CONSTANT.LIST_TYPES.CUSTOM) {
            dxLog.fail('No filter function found for collections of type ' + rootType + '. Add one to ' +
                 ' _filters. In the mean time, all models will be added to the collection.');
        }

        self._dxIsReady = false;
        self._dxIsErrored = false;
        // Keep track of latest outstanding request. We only honor a response if it came from the latest issued request.
        self._latestListToken++;
        var currListToken = self._latestListToken;

        self.sync('read', self, {
            parse: true,
            data: sendableParams,
            success: function(resp) {
                if (self._latestListToken !== currListToken) {
                    return; // Another list request has been issued
                }

                if (resp && resp.type === 'ErrorResult') {
                    var processedResult = context._newClientModel(resp.type);
                    processedResult.set(resp);
                    if (successError && successError.error) {
                        successError.error(processedResult);
                    } else {
                        context.reportErrorResult(processedResult);
                    }
                    self.trigger('error', self);
                    self._dxIsErrored = true;
                    return;
                }

                var resetting = false;
                self._queryParameters = util.deepClone(parameters);
                self._listSuccessError = successError; // save for auto-relisting
                self._dxIsReady = true;
                self._listingMode = LISTINGMODE_LISTING;

                resp = self.parse(resp);

                resetting = removeUnneededModels(self, resp) || self._resetOnList;

                /*
                 * Add the new models.
                 */
                _.each(resp, function(attributes) {
                    var model = context._cache.getCachedModelFromProperties(attributes, {silent: resetting});
                    dxSet.call(self, model, {silent: resetting, _dxAllowSetPassthrough: true});
                });

                self._listingMode = LISTINGMODE_IDLE;

                // Report finishing events
                if (resetting) {
                    self.trigger('reset', self);
                }

                self.trigger('ready', self);

                if (successError && successError.success) {
                    successError.success();
                }
            },
            error: function(xhr) {
                if (self._latestListToken !== currListToken) {
                    return; // Another list request has been issued
                }
                var errorResult = context._convertXhrToErrorResult(xhr);
                context._handleErrorResult(errorResult, successError);
                self.trigger('error', self);
                self._dxIsErrored = true;
            }
        });

        // Return a promise that is resolved once the model is ready, and rejected if the model reports an error
        var deferred = new $.Deferred();
        var listenerContext = {};

        self.once('ready', function() {
            deferred.resolve(self);
            self.off(undefined, undefined, listenerContext);
        }, listenerContext);

        // don't set up the error handler if ready was already triggered
        if (deferred.state() === 'pending') {
            self.once('error', function() {
                deferred.reject(self);
                self.off(undefined, undefined, listenerContext);
            }, listenerContext);
        }

        return deferred.promise();
    }

    /*
     * Retrieve the last set of query parameters passed to $$list().  This is useful if you want to see what this
     * collection currently contains.
     */
    function getQueryParameters() {
        return this._queryParameters;
    }

    /*
     * ========================================
     * Collection creation
     * ========================================
     */

    /*
     * Returns a new DSB collection which is set to be a server collection.
     *
     * resetOnList: If true, $$list()'s will only trigger a single 'reset' event rather than individual 'add' and
     *              'remove' events. Otherwise this happens only when the $$list() fully replaces the contents of the
     *              collection.
     */
    function newServerCollection(typeName, resetOnList) {
        if (util.isNone(typeName)) {
            dxLog.fail('To create a new collection, a type name must be provided.');
        }

        if (!isSchemaType(typeName)) {
            dxLog.fail(typeName + ' is not a known type with a list operation. Can not create this collection.');
        }

        var collection = new context._collectionConstructors[typeName]();
        collection.constructor = Backbone.Collection.extend(); // make clone() return an ordinary backbone collection.
        collection._resetOnList = !!resetOnList;

        return collection;
    }

    function operationNotAllowed() {
        dxLog.fail('Can not call this operation on a Server Collection.');
    }

    /*
     * ========================================
     * Utility functions
     * ========================================
     */

    function isSchemaType(typeName) {
        return !!context._collectionConstructors[typeName];
    }

    /*
     * Return true if the type is the same as baseType or is a subtype.
     */
    function isACompatibleType(type, baseType) {
        if (!context._modelConstructors[type]) {
            return false;
        }

        var typeDef = context._modelConstructors[type].prototype._dxSchema;
        while (typeDef) {
            if (typeDef.name === baseType) {
                return true;
            }
            typeDef = typeDef.parentSchema;
        }

        return false;
    }

    /*
     * Throws error if model (Backbone.Model or attributes) is not compatible with the specified type.
     */
    function assertModelCompatible(aModel, baseType) {
        var type;
        if (aModel instanceof Backbone.Model) {
            type = aModel.get('type');
        } else {
            dxLog.fail('Can not add an arbitrary set of attributes. Must pass a Backbone Model.');
        }

        if (!isACompatibleType(type, baseType)) {
            dxLog.fail('Can not add a model of type ' + type + ' to a collection with a base type of ' + baseType + '.');
        }
    }

    /*
     * Validates that all models are compatible with this collection's type.
     */
    function assertModelsCompatible(models, referenceModel) {
        if (util.isNone(models)) {
            dxLog.fail('Can not call without a model.');
        }

        if (_.isArray(models)) {
            _.each(models, function(model) {
                assertModelCompatible(model, referenceModel._dxInfo.baseType);
            }, this);
        } else {
            assertModelCompatible(models, referenceModel._dxInfo.baseType);
        }
    }

    /*
     * Trigger a 'dirty' event, and if appropriate, set up another call to do a new list operation.
     */
    function triggerDirty(collection) {
        collection.trigger('dirty');
        if (collection.getAutoPageRefresh()) {
            setTimeout(function() {
                dxList.call(collection, collection.getQueryParameters(), collection._listSuccessError);
            }, 0);
        }
    }

    /*
     * ========================================
     * Actually do the work of this function
     * ========================================
     */

    context = context || this;
    context._collectionConstructors = context._collectionConstructors || {};

    _.each(schemas, function(schema, typeName) {
        if (schema.list) {
            // examine return values, in case the return type is not the same as the schema type
            var retObj = schema.list.return;
            var retItemsObj = retObj ? retObj.items : undefined;
            var collectionType = retItemsObj  ? retItemsObj.$ref : (retObj || {}).$ref;
            collectionType = collectionType || schema.name;

            context._collectionConstructors[typeName] = Backbone.Collection.extend({
                _dxInfo: {
                    baseType: collectionType,
                    paramDefs: schema.list
                },
                _dxIsReady: false,
                _dxIsErrored: false,
                _queryParameters: undefined,
                _autoPageRefresh: false,
                _listSuccessError: undefined,
                _listingMode: LISTINGMODE_IDLE,
                url: schema.root,
                _dxEmpty: dxEmpty,
                _dxRemoveModel: Backbone.Collection.prototype.remove,
                _dxAddOrRemove: dxAddOrRemove,
                model: function() {
                    dxLog.fail('Can not create a new model on a collection. Must use the cache.');
                },
                on: dxOn,
                add: operationNotAllowed,
                remove: operationNotAllowed,
                set: dxSet,
                reset: operationNotAllowed,
                push: operationNotAllowed,
                pop: operationNotAllowed,
                unshift: operationNotAllowed,
                shift: operationNotAllowed,
                parse: dxParse,
                fetch: dxFetch,
                create: dxCreate,
                $$list: dxList,
                _latestListToken: 0,
                _resetOnList: false,
                clear: dxClear,
                getQueryParameters: getQueryParameters,
                setAutoPageRefresh: setAutoPageRefresh,
                getAutoPageRefresh: getAutoPageRefresh
            });
        }
    });

    context._newServerCollection = newServerCollection;
};

module.exports = generateCollectionConstructors;

},{"../util/constant.js":16,"../util/util.js":17,"Backbone":1,"dxLog":"dxLog","underscore":"underscore"}],5:[function(require,module,exports){
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

/*global dx */

'use strict';

var _ = require('underscore');

/*
 * Creation listeners provide access to notification updates for API server objects creation in the form
 * of level2 models.
 *
 *   typeName         The schema type for which one receives notifications.
 *
 *   callback         A function to be invoked with a level2 model as argument for each create notification.
 *
 *   queryParams      Optional query parameters used to filter notifications.
 *
 *   context          The context to access other dxData content (cache, filters).
 */
function CreationListener(settings) {
    var self = this;
    if (dx.core.util.isNone(settings.typeName)) {
        dx.fail('To create a new creation listener, a type name must be provided.');
    }
    var typeName = settings.typeName;
    var context = settings.context;
    if (!isListableType(typeName, context)) {
        dx.fail(typeName + ' is not a known type with a list operation. Can not create this creation listener.');
    }
    if (!_.isFunction(settings.callback)) {
        dx.fail('Callback must be provided as a function.');
    }

    self._dxInfo = {
        baseType: settings.typeName
    };

    self.inUse = true;

    self.getQueryParameters = function() {
        return settings.queryParams;
    };

    // The format must remain compatible with level2-collections and level2-cache.
    self._dxAddOrRemove = function(model) {
        if (!self.inUse) {
            return;
        }

        context._filters[typeName](self, model, function(placement) {
            switch (placement) {
                case context._filters.INCLUDE:
                    settings.callback(model);
                    break;
                case context._filters.EXCLUDE:
                    break;
                case context._filters.UNKNOWN:
                    dx.fail('UNKNOWN filter result not supported by creation listeners');
                    break;  // to keep ant check happy.
                default:
                    dx.fail('Filter returned an invalid value.');
            }
        });
    };

    self.dispose = function() {
        self.inUse = false;
    };
}

function isListableType(typeName, context) {
    return !!context._collectionConstructors[typeName];
}

module.exports = CreationListener;

},{"underscore":"underscore"}],6:[function(require,module,exports){
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

/*global dx, $, Backbone */

'use strict';

var _ = require('underscore');

/*
 * Defines general purpose filter routines. These can be used to build type-specific filters.
 *
 * A filter is simply a function that reproduces the server's treatment of the query parameters on the list operation
 * for any type.  Each filter function has the signature
 *    filterFunction(collection, model, resultHandler)
 * The filter function should examine the query parameters on the collection, then examine the properties of the model
 * and call resultHandler with a value indicating how the model should be placed with respect to the collection:
 *    INCLUDE: The model can be put in the collection
 *    EXCLUDE: The model should not be put in the collection (and removed if it is there already)
 *    UNKNOWN: The filter can't determine what to do with the model. Most likely the collection should be re-fetched
 * The potentially asynchronous call to resultHandler is necessary since some query parameters will require retrieval
 * of models to make their determination.
 */

function initFilters(context) {
    var EXCLUDE = 'EXCLUDE';
    var INCLUDE = 'INCLUDE';
    var UNKNOWN = 'UNKNOWN';

    var DATE_PROPS = ['fromDate', 'startDate', 'toDate', 'endDate'];

    /*
     * Helper for non-generated filters. In many cases, the property in the query parameter is the same as that of the
     * attribute in the model. This means we can make a decision synchronously, which keeps the logic in the filters
     * simpler (compare to checkQueryParam(), which returns a promise).
     * This compares the value in the query parameter with that of the model.
     *
     * properties: An array of property names to compare
     * qParams:    The query parameters to compare
     * model:      The model to compare
     */
    function checkSameProps(properties, qParams, model) {
        var result = INCLUDE;

        _.each(properties, function(property) {
            if (_.has(qParams, property) && qParams[property] !== model.get(property)) {
                result = EXCLUDE;
            }
        });

        return result;
    }

    /*
     * When a model is being compared against a collection that has been retrieved with paging, then we can't reliably
     * tell whether the model belongs in the collection. Note that this assumes not specifying a page size implicitly
     * sets it to a particular size (generally 25), while specifying 0 means 'all'
     */
    function checkPageSize(qParams) {
        if (!_.has(qParams, 'pageSize') || qParams.pageSize !== 0) {
            return UNKNOWN;
        }
        return INCLUDE;
    }

    /*
     * Helper function to check date-related query parameters. This assumes qParamName is a valid date property.
     * The caller is responsible for making sure that qParamName is one of DATE_PROPS
     */
    function checkDateProp(qParamVal, qParamName, qpSchema, model, attrName) {
        if (!_.has(qpSchema, 'inequalityType')) {
            dx.fail('Date property "' + qParamName + '" missing "inequalityType" schema property');
        }
        if (dx.core.util.isNone(model.get(attrName))) {
            return EXCLUDE;
        }

        if (_.contains(['fromDate', 'startDate'], qParamName)) {
            if (model.get(attrName).getTime() < qParamVal.getTime()) {
                return EXCLUDE;
            }
        } else if (model.get(attrName).getTime() > qParamVal.getTime()) { // toDate or endDate
            return EXCLUDE;
        }

        if (qpSchema.inequalityType === dx.core.constants.INEQUALITY_TYPES.STRICT &&
                model.get(attrName).getTime() === qParamVal.getTime()) {
            return EXCLUDE;
        }

        return INCLUDE;
    }

    /*
     * Helper for the uberFilter to check an individual query parameter against the model. This may involve
     * asynchronous ServerModel fetches to resolve 'mapsTo' data mapping chains. As a result this returns a promise to
     * the caller. At the moment this only deals with query params that may result in INCLUDE or EXCLUDE - never
     * UNKNOWN.
     * The returned promise is either resolved with INCLUDE or rejected with EXCLUDE.
     */
    function checkQueryParam(qParamVal, qParamName, model, rootSchemaDef) {
        var qpSchema = rootSchemaDef.list.parameters[qParamName],
            deferred = $.Deferred(),
            mapsTo = qpSchema.mapsTo;

        if (!mapsTo) {
            dx.fail('No mapsTo property found for query parameter ' + qParamName + '.');
        }

        var pathSegs = mapsTo.split('.');

        // We know the last seg will be property to compare. Anything before will be a chain of object references.
        var finalAttrName = pathSegs.pop();

        // Recursively walk the data mapping segments
        function followNextSeg(currModel) {
            currModel.once('error', deferred.reject);
            currModel.once('ready', function() {
                if (_.isEmpty(pathSegs)) {
                    // We've reached the end of the path. Do the actual check.
                    var result;

                    if (_.contains(DATE_PROPS, qParamName)) {
                        result = checkDateProp(qParamVal, qParamName, qpSchema, currModel, finalAttrName);
                    } else { // simple property check
                        result = currModel.get(finalAttrName) === qParamVal ? INCLUDE : EXCLUDE;
                    }

                    if (result === INCLUDE) {
                        deferred.resolve(result);
                    } else {
                        deferred.reject(result);
                    }
                } else {
                    // recursive case - continue following path segments.
                    var currPart = '$' + pathSegs.shift();
                    var newModel = currModel.get(currPart);
                    followNextSeg(newModel);
                }
            });
        }

        followNextSeg(model);

        return deferred.promise();
    }

    function getRootedSchema(model) {
        function upwardFind(schema, schemaName) {
            if (dx.core.util.isNone(schema)) {
                dx.fail('Malformed type. Root schema type not found.');
            }

            if (schema.name === schemaName) {
                return schema;
            }

            return upwardFind(schema.parentSchema, schemaName);
        }

        if (!model._dxSchema.rootTypeName) {
            dx.fail('Trying to filter a type that has no root type.');
        }

        return upwardFind(model._dxSchema, model._dxSchema.rootTypeName);
    }

    /*
     * This is the filter to rule all filters. It will filter models for a given collection based on the schema
     * definition and annotations. This may be used as a standalone filter or as a helper for another filter, usually
     * in conjunction with the 'skipParams' argument (see alertFilter).
     * The uberFilter can only handle 'standard' query parameters: simple equality checks, date comparisons, and
     * paging. Similarly there are instances of query parameters that the uberFilter should not attempt to handle.
     * These come in two flavors:
     * 1) Params that do not affect what comes back from the notification system are marked as 'excludeFromFilter' in
     *    the schemas.
     * 2) Params that require special handling can be passed to the uberFilter using the 'skipParams' array.
     */
    function uberFilter(collection, model, resultHandler, skipParams) {
        var qParams = collection.getQueryParameters() || {};
        var schemaDef = getRootedSchema(model);
        var listParams = schemaDef.list.parameters;

        // If the schema definition for list says there are no parameters, then the model can always be included
        if (_.isEmpty(schemaDef.list.parameters)) {
            resultHandler(INCLUDE);
        }

        qParams = _.omit(qParams, skipParams);

        /*
         * If a type could have pageSize, we may need to return UNKNOWN. Otherwise we can keep going in the filter.
         * Note that we don't care about paging params when dealing with creation listeners.
         */
        if (_.has(listParams, 'pageSize') && collection instanceof Backbone.Collection) {
            var pageSizeResult = checkPageSize(qParams);
            if (pageSizeResult === UNKNOWN) {
                return resultHandler(pageSizeResult);
            }
        }
        qParams = _.omit(qParams, ['pageSize', 'pageOffset']);

        if (_.isEmpty(qParams)) {
            return resultHandler(INCLUDE);
        }
        var promises = _.map(qParams, function(qParamVal, qParamName) {
            return checkQueryParam(qParamVal, qParamName, model, schemaDef);
        });

        /*
         * Wait until all query param checks have resolved to make a final decision. Params that might result in
         * UNKNOWN (paging and params we can't handle) are dealt with earlier. Therefore we know each of these promises
         * is either resolved with INCLUDE or rejected with EXCLUDE.
         */
        $.when.apply(undefined, promises)
            .then(function() {
                resultHandler(INCLUDE);
            })
            .fail(function() {
                resultHandler(EXCLUDE);
            });
    }

    /*
     * Simple filter for any type that doesn't actually have query parameters on its list operation (e.g. Group).
     */
    function genericFilter(collection, model, resultHandler) {
        resultHandler(INCLUDE);
    }

    /*
     * Do the real work.
     */
    context = context || this;
    context._filters = context._filters || {};

    _.extend(context._filters, {
        EXCLUDE: EXCLUDE,
        INCLUDE: INCLUDE,
        UNKNOWN: UNKNOWN,
        Notification: uberFilter,
        _checkSameProps: checkSameProps,
        _genericFilter: genericFilter,
        _uberFilter: uberFilter
    });
};

module.exports = initFilters;

},{"underscore":"underscore"}],7:[function(require,module,exports){
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

/*global dx, $, Backbone */

'use strict';

var _ = require('underscore');

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
            if (dx.core.util.isNone(referenceValue)) {
                return;
            }
            if (_.isString(referenceValue)) {
                return context._cache.getCachedModel(referenceValue, getRootType(info.propDef.referenceTo));
            }
            dx.fail('Tried to retrieve a related object with ' + attrName + ' but value was ' + referenceValue + '.');
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
                dx.fail('Tried to change this from ' + self._dxSchema.name + ' to ' + newAttrs.type + '.');
            }
        }

        /*
         * Reject the set if any of the attributes aren't of the right type
         */
        var invalidAttrs = _.omit(newAttrs, _.keys(self._dxSchema.properties || {}));
        if (!_.isEmpty(invalidAttrs)) {
            dx.fail(_.keys(invalidAttrs) + ' are not attributes of a model of type ' + self._dxSchema.name + '.');
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
            dx.fail('Must provide an attribute name.');
        }

        var info = getAttrInfo(this, attrName);

        // dxGet will throw an exception for unknown attributes, so reach directly into the attributes to avoid this
        return info.baseName && !dx.core.util.isNone(this.attributes[info.baseName]);
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
            dx.warn('Got an undefined response, or one without a type in parse().');
            return;
        }

        if (response.type === 'OKResult') {
            return response.result;
        } else if (isSchemaType(response.type)) {
            return response;
        } else {
            dx.warn('Got an unexpected type of response (' + response.type + ') in parse().');
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
            dx.fail('instanceOf() requires a type name as a parameter.');
        }

        if (!isSchemaType(typeName)) {
            dx.fail(typeName + ' is not a known type name.');
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
        dx.fail('Do not call destroy() directly. Instead, call $$delete().');
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
            dx.fail('$$delete does not allow a payload.');
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
            dx.fail('$$create does not allow a payload.');
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
        dx.fail('Do not call save() directly. Instead, call $$update().');
    }

    /*
     * Update the version of this model on the server. This sends to the server:
     *  1) Any required or update:required attributes defined for this type
     *  2) Any required:false or update:optional attributes from the set passed in this function
     */
    function dxUpdate(attributes, successError) {
        var opDef = this._dxSchema.update;

        if (dx.core.util.isNone(attributes) || _.isEmpty(attributes)) {
            dx.fail('$$update must be called with a non-empty set of attributes.');
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
        dx.fail('Do not call fetch() directly. Instead, call getServerModel().');
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
            dx.fail('$' + opName + ' can not be called with a payload (only a success/error object).');
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

        if (!_.isObject(parameters) && !dx.core.util.isNone(parameters)) {
            dx.fail('$' + opName + ' must be passed a (possibly empty) hash of parameters.');
        }

        if (!dx.core.util.isNone(parameters)) {
            sendableParams = checkAndConvertParameters(parameters, opDef.parameters);
        }

        return callOperation(caller, {
                data: sendableParams,
                url: caller._dxGetUrl() + '/' + opName
            }, 'GET', opDef, successError);
    }

    function assertHasReferenceAttr(model, opName, perObject) {
        if (!model.id && perObject) {
            dx.fail('$' + opName + ' can not be called without a reference property set.');
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
            dx.fail('The success handler must be a function, but found a ' + typeof successError.success + '.');
        }

        if (successError && _.has(successError, 'error') && !_.isFunction(successError.error)) {
            dx.fail('The error handler must be a function, but found a ' + typeof successError.error + '.');
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
                    if (dx.core.util.isNone(result) || dx.core.util.isNone(result.type)) {
                        dx.fail('Operation returned success, but without a typed object: ' + result);
                    }
                    if (dx.core.util.isNone(opDef.return) && result.result === '') {
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

        dx.core.ajax.ajaxCall(params);
        return deferred.promise();
    }

    /*
     * Validate that the payload matches the definition for the operation.
     */
    function assertAndPreparePayload(opName, opDef, payload) {
        if (dx.core.util.isNone(payload) && opDef.payload && opDef.payload.required) {
            dx.fail('Must call $' + opName + ' with a payload of type ' + opDef.payload.$ref + '.');
        }

        if (!dx.core.util.isNone(payload)) {
            if (!_.isObject(payload) || !(payload instanceof Backbone.Model)) {
                dx.fail('Must call $' + opName + ' with a backbone model.');
            }

            if (!payload.instanceOf(opDef.payload.$ref)) {
                dx.fail('Must call $' + opName + ' with an instance of ' + opDef.payload.$ref + '.');
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
            dx.fail(_.keys(undefinedParams).join(', ') + ' is not a valid parameter name.');
        }

        _.each(parameters, function(value, key) {
            if (_.isUndefined(value)) {
                dx.fail('Can not send a request with an undefined parameter (' + key + ' is undefined).');
            }
        });

        _.each(paramDefinitions, function(paramDef, paramName) {
            if (_.has(parameters, paramName)) {
                assertValueMatchesDefinition(paramName, parameters[paramName], paramDef);
            } else if (paramDef.required) {
                dx.fail(paramName + ' is required, but has not been passed.');
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
        if (dx.core.util.isNone(typeName)) {
            dx.fail('To create a new model, a type name must be provided.');
        }

        if (!isSchemaType(typeName)) {
            dx.fail(typeName + ' is not a known type name. Can not create one.');
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
        dx.fail('Can not modify a server ' + this._dxSchema.name + ' instance.');
    }

    /*
     * Given a type, locate the root parent type (which will be, when walking up the inheritance chain, the last type
     * that has the same value in its root property)
     */
    function getRootType(childType) {
        if (!_.isString(childType)) {
            dx.fail('Must call with a type name.');
        }

        if (!isSchemaType(childType)) {
            dx.fail(childType + ' is not a known type name.');
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
        var contentType = dx.core.util.isNone(xhr.getResponseHeader) ? undefined :
            xhr.getResponseHeader('content-type');

        if (!dx.core.util.isNone(contentType) &&
            contentType.indexOf('application/json') > -1 &&
            !_.isObject(responseInfo)) {
            try {
                responseInfo = JSON.parse(responseInfo);
            } catch (e) {
                dx.fail('Server response claimed to be application/json, but couldn\'t be parsed as JSON (' +
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
            dx.fail(attrName + ' is not a known attribute.');
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
            dx.fail('Must provide an attribute name.');
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
            if (dx.core.util.isNone(value)) {
                return type;
            } else {
                dx.fail(name + ' has a value, but it has no definition.');
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
                dx.fail(name + ' has to be type ' + ((def.type === 'string' && def.format === 'date') ?
                    'date' : def.type) + ' but is ' + type + ' (' + JSON.stringify(value) + ')');
            } else {
                dx.fail(name + ' has to be type ' + def.type + '/' + def.$ref + ' but is ' + type + '/' + objectType);
            }
        }

        /*
         * Note: def.enum throws an error in IE8.  We're also good with undefined/null from previous checks but those
         * values obviously aren't part of the enum
         */
        if (def.enum && !dx.core.util.isNone(value) && !_.contains(def.enum, value)) {
            dx.fail(name + ' is an enum and has to be one of ' + JSON.stringify(def.enum) + ' but is ' +
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
        dx.fail('This operation does not exist on this instance. (it has been converted from a type that had it).');
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
                if (dx.core.util.isNone(attrValue) && !isNullableType(propDef)) {
                    if (required) {
                        dx.fail('The attribute ' + key + ' is required to be non-null/non-undefined.');
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
        if (dx.core.util.isNone(value) && !isNullableType(propDef)) {
            dx.fail('The attribute ' + key + ' is required to be non-null/non-undefined.');
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

},{"underscore":"underscore"}],8:[function(require,module,exports){
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

/*global dx, $, _, Backbone */

'use strict';

var schema = require('../layer1/schema.js');
var initCache = require('../layer2/cache.js');
var initFilters = require('../layer2/filter.js');
var generateModelConstructors = require('../layer2/model.js');
var generateCollectionConstructors = require('../layer2/collection.js');
var CreationListener = require('../layer2/creationListener.js');
var setupNotificationSystem = require('./notification.js');

/*
 * This defines the public API of the Delphix Data System. It relies heavily on the infrastructure built in the
 * files containing the level 1 and level 2 code.
 *
 * This provides several public functions to get at Delphix-Schema-Based models and collections:
 *     newClientModel                  Returns a 'read/write' model of the specified schema type.
 *
 *     getServerModel                  Returns a 'read-only' model of the specified schema type which is kept in
 *                                     sync with the server as long as it remains a member of a Server Collection.
 *
 *     getServerSingleton              Returns a 'read-only' model of the specified schema type.
 *
 *     getServerCollection             Returns a 'read-only' collection which contains Server Models of a particular
 *                                     type.
 *
 *     getCreationListener             Register a creation listener for a particular type.
 *
 *     getCollectionTypeFromModelType  Returns the name of the collection type that the specified model type belongs to.
 *
 *     setErrorCallback                Set an error callback function that will be called by reportErrorResult on an
 *                                     error.
 *
 *     reportErrorResult               Convenience routine which will display an ErrorResult object to the user on the
 *                                     screen. This is mainly useful if you have an operation error handler which,
 *                                     after examining the ErrorResult model, you still wish to show it to the user.
 */
function DataSystem(schemas) {
    /*
     * Returns a new client model.
     *
     * typeName: The type of the model. If a DB2Container is desired, then DB2Container should be passed.
     */
    function newClientModel(typeName) {
        return context._newClientModel(typeName);
    }

    /*
     * Returns a Server Collection for the specified type.  Each call returns a new collection, which may contain
     * distinct elements from other collections of the same type.  The collection is 'read only', which means its
     * contents may not be directly manipulated. However, its contents may be changed with the $$list() operation on
     * the collection.
     *
     * typeName:    This should be the 'root type' for the collection type wanted. That is, if one wants a collection
     *              of DB2Containers, one should pass 'Container' here.
     * resetOnList: If true, $$list()'s will only trigger a single 'reset' event rather than individual 'add' and
     *              'remove' events. Otherwise this happens only when the $$list() fully replaces the contents of the
     *              collection.
     */
    function getServerCollection(typeName, resetOnList) {
        var collection = context._newServerCollection(typeName, resetOnList);
        context._modelSubscribersStore.add(collection);
        return collection;
    }

    /*
     * Returns a creation listener for the specified type. Each call returns a new listener, which must be disposed
     * so as to free resources.
     *
     *   typeName       The schema type for which one receives notifications.
     *
     *   callback       A function to be invoked with a level2 model as argument for each create notification.
     *
     *   queryParams    Optional query parameters used to filter notifications.
     */
    function getCreationListener(settings) {
        if (dx.core.util.isNone(settings)) {
            dx.fail('Settings must be specified.');
        }
        _.extend(settings, {
            context: context
        });
        var creationListener = new CreationListener(settings);
        context._modelSubscribersStore.add(creationListener);
        return creationListener;
    }

    /*
     * Returns the Server Model representing the specified singleton. If it already exists in the set of models the data
     * system is maintaining, that same instance will be returned. Otherwise a new instance will be returned and its
     * data asynchronously retrieved from the server.
     *
     * typeName:     The name of the type to fetch
     * options:      An object that may contain success and/or error callback functions. If the model is already present
     *               success will be invoked immediately. If it isn't present, success or error will be called once the
     *               underlying fetch has been completed. Additionally, one may set suppressDefaultErrorHandler as an
     *               option here to prevent the default error handler from being executed on error.
     */
    function getServerSingleton(typeName, options) {
        options = _.extend(_.clone(options || {}), {
            update: !context.notification.isStarted()
        });
        var model = context._cache.getCachedSingleton(typeName, options);

        if (!context.notification.isStarted()) {
            model._dxIsReady = false;   // if someone sets a ready handler, don't let it fire until new data is back
        }

        return model;
    }

    /*
     * Return the Server Model instance with the specified reference and of the specified type. If the model already
     * is being maintained by the data system, this will return the same instance. If not, a new instance will be
     * returned, and a request to populate it from data on the server.  To determine if the model has at least an
     * initial set of data, one should assign a 'ready' event handler (probably with the once() function).
     *
     * reference:    The reference for the model
     * typeName:     The type for the model. If the desired model is a DB2Container, can be 'Container' or
     *               'DB2Container'. If the type is not known, assume the most general root type ('Container') should be
     *               passed.
     * suppressDefaultErrorHandler:      If truthy, the default error handled is not triggered on errors.
     */
    function getServerModel(reference, typeName, suppressDefaultErrorHandler) {
        var model = context._cache.getCachedModel(reference, typeName,
            { suppressDefaultErrorHandler: suppressDefaultErrorHandler });

        if (!context.notification.isStarted()) {
            model._dxIsReady = false;   // if someone sets a ready handler, don't let it fire until new data is back
            model._dxFetch({ suppressDefaultErrorHandler: suppressDefaultErrorHandler });
        }

        return model;
    }

    /*
     * Gets a server model and returns a jQuery Promise.
     * This promise is resolved with the model if/when the model's ready' event is triggered.
     * It is rejected if/when the model's 'error' event is triggered.
     * For a description of the parameters see context.getServerModel()
     */
    function getServerModelPromise(reference, typeName, suppressDefaultErrorHandler) {
        var deferred = new $.Deferred();
        var model = context.getServerModel(reference, typeName, suppressDefaultErrorHandler);

        return setupPromise(model, deferred);
    }

    /*
     * Gets a server singleton and returns a jQuery Promise.
     * This promise is resolved with the singleton if/when the model's ready' event is triggered.
     * It is rejected if/when the singleton's 'error' event is triggered.
     * For a description of the parameters see context.getServerSingleton()
     */
    function getServerSingletonPromise(typeName, successError) {
        var deferred = new $.Deferred();
        var model = context.getServerSingleton(typeName, successError);

        return setupPromise(model, deferred);
    }

    /*
     * Helper function for getServerModelPromise and getServerSingletonPromise.
     * Note: This is exposed as _setupPromise for testing purposes only.
     */
    function setupPromise(model, deferred) {
        function onReadyCallback() {
            deferred.resolve(model);
        }
        function onErrorCallback() {
            deferred.reject(model);
        }

        model.once('ready', onReadyCallback);
        model.once('error', onErrorCallback);

        // use promise() to lock to deferred, exposing only methods to attach callbacks
        return deferred.promise();
    }

    /*
     * Given a model type, return the name of the 'root type'. Given DB2Container, OracleContainer, or Container, this
     * will return Container.
     */
    function getCollectionTypeFromModelType(modelType) {
        return context._getRootType(modelType);
    }

    /*
     * Sets an error callback that will be called by reportErrorResult. This is useful for an external system to define
     * behavior that will be used by the dxData system when an ErrorResult is reported by an operation
     */
    var errorCallback;
    function setErrorCallback(func) {
        if (!_.isFunction(func)) {
            dx.fail('setErrorCallback expects a function as an argument.');
        }
        errorCallback = func;
    }

    /*
     * Reports an ErrorResult model to the end user in the best fashion available at this time.
     */
    function reportErrorResult(errorResult) {
        if (!(errorResult instanceof Backbone.Model) || errorResult.get('type') !== 'ErrorResult') {
            dx.fail('reportErrorResult expects an ErrorResult model as an argument.');
        }

        // errorCallback is set by an external source using setErrorCallback
        if (errorCallback) {
            errorCallback(errorResult);
        }

        dx.warn('Error result: ' + JSON.stringify(errorResult.toJSON()));
    }

    /*
     * Start the real work here. Initialize everything 'below' us.
     */
    var context = this; // called by constructor
    var parsedSchemas = schema.prepareSchemas(schemas);
    var enums = schema.prepareEnums(parsedSchemas);
    initCache(context);
    initFilters(context);
    generateModelConstructors(parsedSchemas, context);
    generateCollectionConstructors(parsedSchemas, context);

    setupNotificationSystem(context);

    _.extend(context, {
        parsedSchemas: parsedSchemas,
        enums: enums,
        getServerCollection: getServerCollection,
        getCreationListener: getCreationListener,
        getServerSingleton: getServerSingleton,
        newClientModel: newClientModel,
        getServerModel: getServerModel,
        setErrorCallback: setErrorCallback,
        getServerModelPromise: getServerModelPromise,
        getServerSingletonPromise: getServerSingletonPromise,
        _setupPromise: setupPromise, // Exposed for testing purposes
        reportErrorResult: reportErrorResult,
        getCollectionTypeFromModelType: getCollectionTypeFromModelType
    });
};

module.exports = DataSystem;

},{"../layer1/schema.js":2,"../layer2/cache.js":3,"../layer2/collection.js":4,"../layer2/creationListener.js":5,"../layer2/filter.js":6,"../layer2/model.js":7,"./notification.js":9}],9:[function(require,module,exports){
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

/*global dx, _ */

'use strict';

var dxLog = require('dxLog');

/*
 * This notification system receives updates from the server about objects that have been created, deleted or updated.
 * This system, in turn, converts those notifications into calls to the underlying cache system so all models and
 * collections being used are up to date with whatever information is in the server.  Without the notification system
 * turned on, the models and collections are not assured of being up to date with what the server knows about.
 *
 * To use the notification system, simply call the start() function at the start of your program. To stop receiving
 * notifications, call stop(). You can also call isStarted() to verify whether the notification system is turned on.
 */
function setupNotificationSystem(context) {

    /*
     * We use long polling to fetch notifications. We want to make sure our timeout is less than the browser timeout,
     * but otherwise the call will return as soon as data is available.
     */
    var TIMEOUT_SEC = 12;

    /*
     * If the call fails, we don't want to spin in a loop retrying. Attempt a new request after this time period.
     */
    var RETRY_SEC = 10;

    var date = new Date();
    var timeout;
    var stopped = true;
    var notification;
    var notificationChannel = date.getTime() + '_html';

    function processNotifications(notifications) {
        var uniqueObjectNotifications = {};
        var uniqueSingletonNotifications = {};

        /*
         * Pre-process notifications. Keep only the last notification for a particular object. Thus, should we receive a
         * create, update and delete notification for an object, we will only keep the delete. This assumes that we
         * never get a non-delete notification after getting a delete notification.
         */
        notifications.each(function(model) {
            switch (model.get('type')) {
                case 'ObjectNotification':
                    var reference = model.get('object');
                    uniqueObjectNotifications[reference] = model;
                    break;
                case 'SingletonUpdate':
                    var type = model.get('objectType');
                    if (!_.has(uniqueSingletonNotifications, type)) {
                        uniqueSingletonNotifications[type] = model;
                    }
                    break;
                case 'NotificationDrop':
                    dx.core.util.reloadClient(dx.gls('dx.notification_drop', model.get('dropCount')));
                    break;
                // we ignore all other types
            }
        });

        /*
         * With the uniquified set of object notifications, loop through them and retrieve or delete our copies of the
         * objects on the server
         */
        _.each(uniqueObjectNotifications, function(notification, objRef) {
            try {
                var type = notification.get('objectType');
                var rootType = context.getCollectionTypeFromModelType(type);

                switch (notification.get('eventType')) {
                    case 'CREATE':
                    case 'UPDATE':
                        var subscriptionUsesModel = context._modelSubscribersStore.hasType(rootType);
                        var hasModel = context._cache.containsCachedModel(objRef, rootType);
                        if (subscriptionUsesModel || hasModel) {
                            var model = context._cache.getCachedModel(objRef, rootType, {
                                update: true,
                                cacheOnlyIfNeeded: true,
                                suppressDefaultErrorHandler: true
                            });
                            model.once('error', function(model, err) {
                                dxLog.warn('Got an error when doing a ' + notification.get('eventType') + ' on ' +
                                    objRef + '.', err.toJSON());
                            });
                        }
                        break;
                    case 'DELETE':
                        context._cache.deleteCachedModel(objRef, rootType);
                        break;
                    default:
                        dxLog.warn('Unknown event type: ' + notification.get('eventType'));
                }
            } catch (e) {
                // We really don't want notification processing to stop, so swallow any exception and keep going
                dxLog.warn('notification processing failed: ' + e.message);
            }
        });

        /*
         * Finally, update all the singletons that have been changed, as well.
         */
        _.each(uniqueSingletonNotifications, function(notification, type) {
            try {
                context._cache.getCachedSingleton(type, {update: true});
            } catch (e) {
                // We really don't want notification processing to stop, so swallow any exception and keep going
                dxLog.warn('notification processing failed: ' + e.message);
            }
        });
    }

    function fetchNotifications() {
        timeout = undefined;

        notification.$$list({
            timeout: '' + TIMEOUT_SEC * 1000,
            channel: notificationChannel
        }, {
            success: function() {
                // We want to make sure notifications don't ever stall, even if there is some unknown problem
                if (!stopped) {
                    try {
                        processNotifications(notification);
                    } finally {
                        fetchNotifications();
                    }
                }
            },
            error: function() {
                if (!stopped) {
                    dxLog.warn('Notification call failed.');
                }

                if (stopped) {
                    return;
                }

                timeout = setTimeout(fetchNotifications, RETRY_SEC * 1000);
            }
        });
    }

    /*
     * For testing purposes. This returns the timeout used for retries for predictable results.
     */
    function _getRetryTimeout() {
        return RETRY_SEC * 1000;
    }

    function start() {
        if (_.isUndefined(notification)) {
            notification = context.getServerCollection('Notification');
        } else {
            dxLog.fail('Notification system already started.');
        }
        stopped = false;
        fetchNotifications();
    }

    function isStarted() {
        return !stopped;
    }

    function stop() {
        if (notification) {
            notification = undefined;
        }
        if (timeout) {
            clearTimeout(timeout);
        }
        stopped = true;
    }

    context = context || dx.core.data;
    context.notification = context.notification || {};
    _.extend(context.notification, {
        _getRetryTimeout: _getRetryTimeout,
        start: start,
        isStarted: isStarted,
        stop: stop
    });
};

module.exports = setupNotificationSystem;

},{"dxLog":"dxLog"}],10:[function(require,module,exports){
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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global module, console */

'use strict';

/*
 * This module defines a simple logging interface. By default, this will log messages to the console.
 * The logging functions are:
 *    dxLog.fail();
 *    dxLog.warn();
 *    dxLog.info();
 *    dxLog.debug();
 * If the dxLog.level value is set to FAIL, WARN, INFO or DEBUG, then log messages will only be written out at
 * the specified level or higher (thus, if set to INFO, the default, DEBUG messages will not be logged)
 */

/*
 * Define constants for the logging level
 */
var LEVEL = {
    FAIL: 80,
    WARN: 60,
    INFO: 40,
    DEBUG: 20
};

/*
 * Report a failing message. Writes the info to the console and throws an error
 */
function fail() {
    if (module.exports.level <= LEVEL.FAIL) {
        console.error.call(console, arguments);
    }
    throw new Error(arguments[0]);
}

/*
 * Report a warning message. Writes the info to the console
 */
function warn() {
    if (module.exports.level <= LEVEL.WARN) {
        console.warn.call(console, arguments);
    }
}

/*
 * Report an info message. Writes the info to the console
 */
function info() {
    if (module.exports.level <= LEVEL.INFO) {
        console.info.call(console, arguments);
    }
}

/*
 * Report an debug message. Writes the info to the console
 */
function debug() {
    if (module.exports.level <= LEVEL.DEBUG) {
        console.info.call(console, arguments);
    }
}

module.exports = {
    LEVEL: LEVEL,
    level: LEVEL.INFO,
    fail: fail,
    warn: warn,
    info: info,
    debug: debug
};

},{}],11:[function(require,module,exports){
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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global $, require, module */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');

var ServerCore = require('./ServerCore.js');

/*
 * This is an abstract supertype which provides common behavior for starting and stopping a mock server as well as
 * jQuery compatible behavior for receiving calls to $.ajax() making calls to ServerCore, and making calls back to
 * through the jQuery callbacks.  What this doesn't provide is exactly how the server reacts between the return from
 * the ServerCore call(s) and making the callbacks to the jQuery callbacks. That is the primary area for subtypes to
 * augment this.
 *
 * When a server is started, it replaces the standard jQuery ajax function with its own, and thereafter processes those
 * queries. It redirects the call as appropriate to the ServerCore, and then asks subtypes to decide what to do with
 * the Result that comes back from that.
 *
 * This provides a set of routines for subtypes to use to process and ultimately deliver results to the callers.
 */

var JSON_MIME_TYPE = 'application/json';
var TEXT_MIME_TYPE = 'text/plain';

// Mapping of HTTP status codes to text. https://www.ietf.org/rfc/rfc2616.txt
var HTTP_STATUS_TEXT = {
    100: 'Continue',
    101: 'Switching Protocol',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    306: '(Unused)',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'Internal Server Error'
};

/*
 * Replacement for jQuery's ajax function.  This handles these aspects of jquery's behavior:
 * It will then pass the url and settings.data on to ServerCore, and then ask subtypes to deal with the Result.
 * This also does provide the notification long poll support.
 */
function replacementAjaxHandler(url, settings) {
    var self = this;

    // parameters can be $.ajax(settings) or $.ajax(url, settings)
    if (_.isObject(url)) {
        settings = url;
        url = settings.url;
    }
    var messageBody = settings.data;
    var isNotificationCall = url.indexOf(self._notificationUrl) !== -1;
    var method = settings.type || 'GET';    // default to GET if needed.
    method = method.toUpperCase();

    self._ajaxCallId++;
    self._reportDebug(self._ajaxCallId, 'Receive ' + method + ':' + url);

    if (isNotificationCall) {
        self._pendingLongpolls.push(addToResult({}, settings, self._ajaxCallId));
    } else {
        var result = self[method](url, messageBody);

        if (result.statusCode === self.UNKNOWN_URL_STATUS) {
            self._handleUnknownUrl(method, url, settings);
        } else {
            self._handleResult(addToResult(result, settings, self._ajaxCallId));
        }
    }
}

// Given a Response object, create a duck-typed jQuery XHR
function PseudoXhr(result) {
    var self = this;

    self.readyState = 4;
    self.status = result.statusCode;
    self.statusText = HTTP_STATUS_TEXT[result.statusCode];

    // In the majority of cases, responseText is never evaluated, so lazily compute it (since it may involve stringify)
    Object.defineProperty(self, 'responseText', {
        get: function() {
            if (result.dataText) {
                return result.dataText;
            }

            if (_.isString(result.data)) {
                return result.data;
            }

            return JSON.stringify(result.data);
        },
        enumerable: true
    });
}

// dxData calls this under error circumstances to check the data type of the return
PseudoXhr.prototype.getResponseHeader = function getResponseHeader(header) {
    var self = this;

    if (header.toLowerCase() === 'content-type') {
        if (parseJSON(self.responseText) instanceof Error) {
            return TEXT_MIME_TYPE;
        }
        return JSON_MIME_TYPE;
    }

    return '';
};

// Augment a result object with other (private) information that this will need later to deliver the Result to callbacks
function addToResult(result, settings, callId) {
    result.async = settings.async;
    result.dataType = settings.dataType && settings.dataType.toUpperCase();
    result.success = settings.success;
    result.error = settings.error;
    result.status = settings.statusCode && settings.statusCode[result.statusCode];
    result.callId = callId;

    return result;
}

/*
 * Overridable routine that lets a subtype do something with each result.
 * Expected parameters: result
 */
function handleResult() {
    dxLog.fail('handleResult() must be overridden.');
}

/*
 * Overridable routine to cope with a call that the ServerCore couldn't handle
 * Expected parameters: method, url, settings
 */
function handleUnknownUrl() {
    dxLog.fail('handleUnknownUrl() must be overridden.');
}

/*
 * Given a result (decorated with the information from addToResult()) process it and deliver to the client.
 */
function deliverResult(server, result) {
    if (result.statusCode >= 200 && result.statusCode < 300 || result.statusCode === 304) {
        /*
         * Most of the time, the mock server returns data as a JavaScript object (not truly JSON). However, one can add
         * a JavaScript file as a resource and retrieve it, in which case we will receive a true JSON value.  If the
         * client told us it was expecting JSON data, mimic jQuery's behavior, parse the JSON and return the result.
         */
        if (result.dataType === 'JSON' && _.isString(result.data)) {
            var parsing = parseJSON(result.data);
            if (parsing instanceof Error) {
                invokeCallbacks(server, result, 'parsererror', parsing);
                return;
            } else {
                result.dataText = result.data;
                result.data = parsing;
            }
        // if the client is asking for a script, mimic jQuery and eval it.
        } else if (result.dataType === 'SCRIPT') {
            var evalResult = evalJavaScript(result.data);
            if (evalResult instanceof Error) {
                invokeCallbacks(server, result, 'parsererror', evalResult);
                return;
            }
        }
        invokeCallbacks(server, result, 'success');
    } else {
        invokeCallbacks(server, result, 'error');
    }
}

function invokeCallbacks(server, result, status, errorObject) {
    var xhr = new PseudoXhr(result);
    var count = 0;
    var callbacks = [].concat(result.status);
    if (status === 'success') {
        _.each(callbacks.concat(result.success), function(cb) {
            if (cb) {
                cb(result.data, 'success', xhr);
                count++;
            }
        });
    } else {
        _.each(callbacks.concat(result.error), function(cb) {
            if (cb) {
                cb(xhr, status, errorObject || xhr.statusText);
                count++;
            }
        });
    }

    server._reportDebug(result.callId, (count > 0) ? 'Deliver ' + status : 'No callbacks');
}

/*
 * Parse a JSON string and either return the parsed result or an Error instance.  This is done as a separate routine
 * to limit the impact of the try-catch block which in some browsers makes the routine something it can't optimize.
 */
function parseJSON(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return error;
    }
}

/*
 * Eval a string as JavaScript.  This is in a separate routine to limit the non-optimizability of the try-catch block.
 */
function evalJavaScript(javaScriptString) {
    try {
        $.globalEval(javaScriptString);
    } catch (error) {
        return error;
    }
}

function findNotificationUrlBase(schemas) {
    var notificationSchema = _.find(schemas, function(schema) {
        return schema.name === 'Notification';
    });

    if (!notificationSchema || !notificationSchema.root) {
        dxLog.fail('Schemas do not include a Notification type.');
    }

    return notificationSchema.root;
}

/*
 * Handle longpoll notifications. If there are notifications to be delivered and there are open longpoll
 * requests, then deliver those results to the longpoll calls.
 */
function processNotifications(server) {
    if (server.getCollectionLength('Notification') && server._pendingLongpolls.length > 0) {
        var result = server.GET(server._notificationUrl);
        server.clearCollection('Notification');

        _.each(server._pendingLongpolls, function(resultExtras) {
            var fullResult = _.extend(_.clone(result), resultExtras);
            server._handleResult(fullResult);
        });
        server._pendingLongpolls = [];
    }
}

/*
 * Report a debug message
 */
function reportDebug(server, callId, message, data) {
    if (!server.debug) {
        return;
    }

    // Special case OK and List results. Just show the returned data
    if (data && data.result) {
        data = data.result;
    }
    var jsonData = data ? ' ' + JSON.stringify(data) : '';
    if (jsonData.length > 100) {
        jsonData = jsonData.substr(0, 100) + '...';
    }

    dxLog.debug('Call ' + callId + ': ' + message + jsonData);
}

/*
 * Start the server, by redirecting all jquery ajax calls to it.
 */
function startMockServer() {
    var self = this;
    if ($.ajax === self._currentAjax) {
        dxLog.fail('This server is already started.');
    }
    self._previousAjax = $.ajax;

    // create a unique function as our handler, and make sure it has ourself as its 'this'
    $.ajax = replacementAjaxHandler.bind(self);

    // Record which $.ajax function we're associated with
    self._currentAjax = $.ajax;
}

/*
 * Turn off the server, restoring ajax traffic to wherever it would have gone before.
 */
function stopMockServer() {
    var self = this;
    if (!self._previousAjax) {
        dxLog.fail('This server has not been started.');
    }
    // Check if $.ajax is our function, or is a jasmine spy on our function.
    if ($.ajax !== self._currentAjax && $.ajax.originalValue !== self._currentAjax) {
        dxLog.fail('This server is not the active $.ajax handler, and so can not be stopped.');
    }

    /*
     * Ick ick ick ick.  If a test spys on ajax, and then this mock server is stopped, this will replace the original
     * handler, and then when the test ends, Jasmine will return the "currentAjax" value back to $.ajax.  There is no
     * way to avoid this using Jasmine except to always put a spy on $.ajax in jasmineSetup, and then having the mock
     * servers work with that, which leads to other ugliness.  Instead, we just notice that there is a spy here, and
     * replace the value it will restore at the end of the test.
     */
    if ($.ajax.originalValue === self._currentAjax) {
        $.ajax.originalValue = self._previousAjax;
    }

    // undo our starting
    $.ajax = self._previousAjax;
    delete self._currentAjax;
    delete self._previousAjax;
}

function AbstractServer(schemas, filters) {
    var self = this;
    if (!(self instanceof AbstractServer)) {
        dxLog.fail('Must call AbstractServer() with new.');
    }
    if (!_.isObject(schemas)) {
        dxLog.fail('Must pass a map of schemas when constructing a server.');
    }

    var server = new ServerCore(schemas, filters);

    _.extend(server, {
        _pendingLongpolls: [],
        _notificationUrl: findNotificationUrlBase(schemas),
        _ajaxCallId: 0,
        debug: false,
        _handleUnknownUrl: handleUnknownUrl,
        _handleResult: handleResult,
        _processNotifications: _.partial(processNotifications, server),
        _deliverResult: _.partial(deliverResult, server),
        _reportDebug: _.partial(reportDebug, server),
        _addToResult: addToResult,
        start: startMockServer,
        stop: stopMockServer
    });

    return server;
}

module.exports = AbstractServer;

},{"./ServerCore.js":14,"dxLog":"dxLog","underscore":"underscore"}],12:[function(require,module,exports){
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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global $, require, module */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');

var AbstractServer = require('./AbstractServer.js');

/*
 * ApiServer is a server is meant to be run in an interactive session within a browser. For example, you may want to
 * run your UI using the mock data in the server, but want to rely on fetching of other server resources from a real
 * server.
 * In general, what the ApiServer does is defer to the ServerCore to handle api calls, but when the ServerCore doesn't
 * know what to do with that call, this will then direct the query to the original $.ajax handler which will then
 * contact the real server.
 * This also will deliver results from the server core asynchronously.
 *
 * To use ApiServer, simply do the following:
 *    var server = new ApiServer(schemas);
 *    server.start();
 *
 * It is best if this is done before anything else has started interacting with the network.
 */

/*
 * If the MockServer can't figure out what to do with this call, hand it off to the real server.
 */
function handleUnknownUrl(server, method, url, settings) {
    var self = this;
    self._previousAjax(url, settings);
}

/*
 * When a callback is ready to be dealt with, run it in a setTimeout() call so it will happen
 * asynchronously from the caller's standpoint.
 */
function handleResult(server, result) {
    setTimeout(function() {
        server._deliverResult(result);
        server._processNotifications();
        $.event.trigger('ajaxComplete');
    }, 0);
}

function ApiServer(schemas, filters) {
    var self = this;
    if (!(self instanceof ApiServer)) {
        dxLog.fail('Must call ApiServer() with new.');
    }

    var server = new AbstractServer(schemas, filters);
    server._handleUnknownUrl = _.partial(handleUnknownUrl, server);
    server._handleResult = _.partial(handleResult, server);

    function performThenCheckNotifications(origFunction) {
        origFunction.apply(server, _.rest(arguments));
        server._processNotifications();
    }

    server.createObjects = _.wrap(server.createObjects, performThenCheckNotifications);
    server.updateObjects = _.wrap(server.updateObjects, performThenCheckNotifications);
    server.deleteObjects = _.wrap(server.deleteObjects, performThenCheckNotifications);

    return server;
}

module.exports = ApiServer;

},{"./AbstractServer.js":11,"dxLog":"dxLog","underscore":"underscore"}],13:[function(require,module,exports){
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

/*global require, module */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');

var util = require('../util/util.js');
var CONSTANT = require('../util/constant.js');

/*
 * Defines a set of filter helper functions for delphix schema root types to be used by the Mock Server.
 *
 * mockCollectionFilters differ from layer2/filters in a number of ways:
 * 1. These are synchronous, as the mockServer is written synchronously. layer2/filters are async.
 * 2. These deal with plain objects, while layer2/filters must deal with Backbone models.
 * 3. These have a global view of the objects in the system, and can thus deal with things like paging, whereas
 *    layer2/filters can not.
 *
 * Many filters can be autogenerated from the schemas and schema annotations defined in layer1/schema.js. These use the
 * uberFilter. However, there are still some types which cannot be autogenerated due to complex logic which cannot be
 * inferred from the schema.
 *
 * Each filter function takes in a collection and a hash of query parameters, and will return the filtered version of
 * the collection.
 */

var DATE_PROPS = ['fromDate', 'startDate', 'toDate', 'endDate'];

function missingObject(type, reference) {
    dxLog.fail('The ' + type + ' (' + reference + ') does not exist in the mock server and is needed to filter your ' +
            '$$list operation.');
}

// Parse the 'mapsTo' property for the query parameter and follow the data mapping chain
function followDataMapping(object, mapsTo, filterSupport) {
    var self = this;
    var parts = mapsTo.split('.');

    // We know the last part will be property to compare. Anything before that will be a chain of object dereferencing
    var finalAttrName = parts.pop();

    var currObj = object;
    _.each(parts, function(part) {
        var type = self._schemas[currObj.type].properties[part].referenceTo;

        var newObj = filterSupport.server.getObject(currObj[part], type);
        if (!newObj) {
            missingObject(type, currObj[part]);
        }

        currObj = newObj;
    });

    return { object: currObj, attrName: finalAttrName };
}

/*
 * Helper for a single query parameter. Will follow a data mapping and check that the qParam value matches the object's
 * property value.
 */
function checkSimpleProp(qParamVal, qParamName, object, filterSupport) {
    var self = this;
    var objectSchema = self._schemas[filterSupport.type];
    var mapsTo = objectSchema.list.parameters[qParamName].mapsTo;
    if (!mapsTo) {
        dxLog.fail('No mapsTo property found for query parameter ' + qParamName + '.');
    }

    var pair = followDataMapping.call(self, object, mapsTo, filterSupport);
    var finalObj = pair.object;
    var finalAttrName = pair.attrName;

    return qParamVal === finalObj[finalAttrName];
}

/*
 * Helper for a single query parameter. Will follow a data mapping and check a date-related query parameter.
 */
function checkDateProp(qParamVal, qParamName, object, filterSupport) {
    var self = this;
    var objectSchema = self._schemas[filterSupport.type];

    var mapsTo = objectSchema.list.parameters[qParamName].mapsTo;
    if (!mapsTo) {
        dxLog.fail('No mapsTo property found for query parameter ' + qParamName);
    }

    if (!_.contains(DATE_PROPS, qParamName)) {
        dxLog.fail('Expected a date related query parameter (' + DATE_PROPS.join(', ') + ') but found: ' + qParamName);
    }

    var inequalityType = objectSchema.list.parameters[qParamName].inequalityType;

    if (_.isUndefined(inequalityType)) {
        dxLog.fail('Date property "' + qParamName + '" missing "inequalityType" schema property');
    }

    var pair = followDataMapping.call(self, object, mapsTo, filterSupport);
    var finalObj = pair.object;
    var finalAttrName = pair.attrName;

    // Since we are at the mockServer level, the query parameters passed in may be timestamps, not Date objects
    if (!_.isDate(qParamVal)) {
        qParamVal = new Date(qParamVal);
    }

    // Handle the case where this is a timestamp string as well as a Date object
    var objAttrVal = finalObj[finalAttrName];
    if (_.isString(objAttrVal)) {
        objAttrVal = new Date(objAttrVal);
    }

    if (util.isNone(objAttrVal)) {
        return false;
    }

    if (_.contains(['fromDate', 'startDate'], qParamName)) {
        if (objAttrVal.getTime() < qParamVal.getTime()) {
            return false;
        }
    } else if (objAttrVal.getTime() > qParamVal.getTime()) { // toDate or endDate
        return false;
    }

    if (inequalityType === CONSTANT.INEQUALITY_TYPES.STRICT && objAttrVal.getTime() === qParamVal.getTime()) {
        return false;
    }

    return true;
}

/*
 * Helper to determine if a mock server object should be included given it's index and paging parameters.
 * Note that this assumes not specifying a page size implicitly sets it to a particular size (generally 25),
 * while specifying 0 means 'all'.
 */
function checkPageSize(qParams, objectIndex, collectionLength) {
    var start, end, pageSize, pageOffset;

    if (qParams.pageSize === 0) {
        return true;
    }

    pageSize = qParams.pageSize || 25;
    pageOffset = qParams.pageOffset || 0; // No pageOffset gives you the page with the most recent data

    if (pageSize < 0) {
        dxLog.fail('pageSize must be a positive integer');
    }

    if (pageOffset >= 0) {
        end = collectionLength - pageSize * pageOffset - 1;
        start = Math.max(0, end - pageSize + 1);
    } else {
        // Negative offset takes the page from the older end of the collection, with -1 being the oldest
        start = pageSize * -(pageOffset + 1);
        end = Math.min(collectionLength - 1, start + pageSize - 1);
    }

    return objectIndex >= start && objectIndex <= end;
}

/*
 * Check an array of query parameters against an object.
 */
function checkProps(qParamNamesToCheck, qParams, object, filterSupport) {
    var self = this;

    return _.every(qParamNamesToCheck, function(qParamName) {
        if (!_.has(qParams, qParamName)) {
            return true;
        }

        var dateParams = ['fromDate', 'startDate', 'toDate', 'endDate'];
        var qParamVal = qParams[qParamName];

        if (_.contains(dateParams, qParamName)) {
            return checkDateProp.call(self, qParamVal, qParamName, object, filterSupport);
        } else {
            return checkSimpleProp.call(self, qParamVal, qParamName, object, filterSupport);
        }
    });
}

/*
 * One filter to rule them all, one filter to find them,
 * One filter to bring them all and in the darkness bind them.
 *
 * In the days of old there were many filters freely roaming the land. At the end of the second age, schema annotations
 * were introduced into level1-schemas.js. This gave the dark lord all the tools he needed to corral the filters into a
 * single uberFilter, thus beginning a period of darkness and code maintainability. However, a few misfit filters
 * managed to escape the all seeing gaze of the dark lord, their logic simply too complex to be handled by the
 * uberFilter.
 */
function uberFilter(collection, qParams, filterSupport) {
    var self = this;
    return _.filter(collection, function(object) {
        return checkProps.call(self, _.keys(qParams), qParams, object, filterSupport);
    });
}

/*
 * uberFilter needs the type to get schema information. This wraps uberFilter and returns a function that conforms to
 * the signature expected by mockServer.
 */
function makeUberFilter(type) {
    return function wrappedUberFilter(collection, qParams, filterSupport) {
        return uberFilter(collection, qParams, filterSupport);
    };
}

/*
 * Wraps an individual filter function to take care of logic around paging.
 */
function maybeAddPagingToFilter(type, filterFunc) {
    var self = this;
    var supportsPaging = 'pageSize' in self._schemas[type].list.parameters;

    return function wrappedFilter(collection, qParams) {
        var pagingParams,
            result = collection;

        // Separate paging parameters from other parameters
        pagingParams = _.pick(qParams, 'pageSize', 'pageOffset');
        qParams = _.omit(qParams, 'pageSize', 'pageOffset');

        result = filterFunc(collection, qParams);

        if (supportsPaging) {
            result = _.filter(result, function(object, index) {
                return checkPageSize(pagingParams, index, result.length);
            });
            // The most recent result should be the first (index 0) in the list
            result.reverse();
        }

        return result;
    };
}

/*
 * Applies the specified filterFunc, and then if the type supports paging, page the results
 */
function filterWithPaging(filterFunc, collection, qParams, filterSupport) {
    var self = this;
    var supportsPaging = 'pageSize' in self._schemas[filterSupport.type].list.parameters;
    var pagingParams,
        result = collection;

    // Separate paging parameters from other parameters
    pagingParams = _.pick(qParams, 'pageSize', 'pageOffset');
    qParams = _.omit(qParams, 'pageSize', 'pageOffset');

    result = filterFunc(collection, qParams);

    if (supportsPaging) {
        result = _.filter(result, function(object, index) {
            return checkPageSize(pagingParams, index, result.length);
        });
        // The most recent result should be the first (index 0) in the list
        result.reverse();
    }

    return result;
}

function MockFilterUtils(schemas) {
    var self = this;

    self._schemas = schemas;
    self.uberFilter = uberFilter;
    self.makeUberFilter = makeUberFilter;
    self.missingObject = missingObject;
    self.checkProps = checkProps;
    self.maybeAddPagingToFilter = maybeAddPagingToFilter;
    self.filterWithPaging = filterWithPaging;
}

module.exports = MockFilterUtils;

},{"../util/constant.js":16,"../util/util.js":17,"dxLog":"dxLog","underscore":"underscore"}],14:[function(require,module,exports){
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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global require, module */

'use strict';

var _ = require('underscore');
var dxLog = require('dxLog');

var MockFilterUtils = require('./MockFilterUtils.js');

/*
 * ServerCore provides support for all the data management required of a Delphix Schema-based server (storing objects,
 * responding to operations). It is intended to be used as a base type for various mock servers, allowing subtypes to
 * provide specialized server behavior without needing to re-invent the data and operation management.
 * ServerCore provides support for storing Delphix Schema defined singleton objects and collections of objects, as
 * well as support for the operations defined by those schemas, including  standard operations (read, list, create,
 * update, delete), object operations, and root operations.
 *
 * CONSTRUCTION AND FILTERS
 * A ServerCore instance can be constructed with one or two parameters:
 *    var server = new ServerCore(schemas, filters);
 * The schemas parameter, which is required, is a map of Delphix-style json-schemas in this format (where url-path.json is
 * the same url path found as the value for properties like $ref, etc):
 *    {
 *        './url-path.json': { ... schema definition ...},
 *        ...
 *    }
 * The optional filters parameter, is an object in this format:
 *    {
 *        TypeName: function(collection, queryParameters, filterSupport),
 *        ...
 *    }
 * The collection will be an array of JavaScript objects that the server is ready to return to the client that this function
 * is being asked to filter. The queryParameters is an object with key/value pairs corresponding to the query parameters
 * passed to the server in the retrieval call. filterSupport is an object with three values:
 *    type: The type of the collection. This is the same as the TypeName specified in the filter definition. It is
 *          included for cases where the same filter function supports multiple types.
 *    server: A reference to the ServerCore instance that is invoking this call. This is useful to reach back into the
 *          server to look up related objects.
 *    mockFilterUtils: a MockFilterUtils instance which has several utility functions that your filter may wish to use.
 * The filter function must return the set of objects from the collection that are to be returned to the caller.
 *
 * DATA
 *      createObjects()
 *      updateObjects()
 *      deleteObjects()
 *
 * These three routines add, update and delete objects and singletons in the server, respectively. By default, each
 * also creates the appropriate Notification objects (e.g. object creation notifications) for non-singleton objects,
 * though this can be overridden with a second argument.  The first argument to each can be either an object or an
 * array.
 *
 * When it is an object, it must have this structure:
 *    {
 *        TypeName : [ {
 *            { ... properties ... },
 *            { ... properties ... },
 *            ...
 *        } ],
 *        TypeName : { ... properties ... },
 *        ...
 *    }
 * Each of the "{ ... properties ... }" in the above description is a collection of properties for a particular
 * object instance as defined by the corresponding schema (but it need not be all the properties).
 * TypeName is either a singleton type name, or the name of a type that has a root property or a type descended from
 * a type with a root property.
 * If the individual objects do not have a type property, one will be added using the TypeName value.
 *
 * When it is an array, then it must have this structure:
 *    [{ ... properties ... }, { ... properties ... }, ...]
 *
 * There are some special cases for each of the three functions. In particular:
 *  - createObjects() will automatically add a generated reference property if the object type allows it and one isn't
 *                    provided in the "{ ... properties ... }" declaration
 *  - updateObjects() requires that there be a reference property in each object declaration.
 *  - deleteObjects() Requires a reference property. It can also accept an array of raw object references rather than
 *                    a whole object definition when the argument is an array.
 *
 * Note that these do not do full validation of the values passed in, so if dxData calls fail reporting that
 * invalid properties were received, you should check your object definitions.
 *
 *      getSingleton()
 *      getObject()
 *      getCollection()
 *      clearCollection()
 *      getCollectionLength()
 *
 * These provide access to copies of the objects within the server.
 *
 * OPERATIONS
 *      addResources()
 *
 * This is used to register values that should be returned when a particular URL is GET'ed from the server.
 *
 *      addStandardOpHandlers()
 *      addStandardOpHandler()
 *      addRootOpHandlers()
 *      addRootOpHandler()
 *      addObjectOpHandlers()
 *      addObjectOpHandler()
 *
 * These are used to set up handlers for Standard Operations (list, read, create, update, delete), root operations and
 * object operations as defined by the schemas. The plural forms all take arguments in this form:
 *    {
 *        RootTypeName : {
 *            opName: function() {},
 *            ...
 *        },
 *        ...
 *    }
 * After the operation handler has been installed, any call to that operation on the server will invoke the handler.
 * Note that if a handler already exists in the server, a second addFooOperation call will replace the first.
 * The singular forms all take arguments in this form:
 *    addFooOperation(RootTypeName, operationName, function() {});
 *
 * The handlers take one of the following signatures:
 *    objectHandler(reference, payload, Result, server)
 *        This is for object operations, read, update and delete standard operations.
 *    otherHandler(payload, Result, server);
 *        This is for root operations, list and create standard ops, and singleton read, update and create operations.
 *
 *        reference: The reference of the object being manipulated
 *        payload: The payload of the call (or query parameters)
 *        Result: A constructor function for returning a value. See below
 *        server: A reference to the server making this call to the routine.
 *
 * Each of these functions must return either an arbitrary value, or a Result instance.  If a non-Result instance is
 * returned, the server assumes that it is a successful result, and calls new Result.OkResult(returnValue) for you.
 *
 *     Result(statusCode, data)
 *     Result.OkResult(okResultResult)
 *     Result.ListResult(listResultResult)
 *     Result.ErrorResult(statusCode, errorResultError)
 *     Result.MissingObjResult(type, reference, operation)
 *
 * These constructor functions generate Result instances with an HTTP Status Code and data to be returned to the caller.
 * Result() is the most generic and returns in the body whatever is in the second parameter.
 *
 * URL ACCESS
 *
 *     GET(url, parameters)
 *     POST(url, payload)
 *     DELETE(url, payload)
 *
 * These three routines let you do the equivalent of an HTTP GET, POST or DELETE on the server to the specified URL
 * with the named parameters or payload.  Each returns an object with a statusCode and data property. If the specified
 * url isn't supported by the server, then the return value is equivalent to new Result(server.UNKNOWN_URL_STATUS,
 * undefined);
 */

var OBJECT_OPERATION_REGX = new RegExp('(^.*)/([^/]+)/([^/]+)(\\?[^/]+)?$');   // anything/objref/operation?params
var OBJECT_READ_UPDATE_DELETE_REGEX = new RegExp('(^.*)/([^/]+)$');       // anything/something
var INLINE_REF = '/{ref}/';
var TRAILING_REF = '/{ref}';
var START_REF = 1000;
var STANDARD_OPERATONS = ['list', 'read', 'create', 'update', 'delete'];

/*
 * Creates a set of objects in the mock server that can be accessed and manipulated by other operations on the mock
 * server.
 *
 * The parameters for this are discussed in the header comment to this file.
 *
 * Note:
 *   * In all cases, if the object type allows for a reference property, and that is not included in the object
 *     structure, then this will automatically add one.
 *   * If the object type has a reference, then a corresponding CREATE notification object will be automatically created
 *     unless skipNotifications is true.
 *   * You can "create" a singleton with this call. In that case, it will simply behave the same as an update.
 */
function createObjects(server, newObjects, skipNotifications) {
    return processArgumentsWithHandler(newObjects, skipNotifications, _.partial(createObject, server));
}

/*
 * Given an object, do the following:
 *   - Convert its properties to a JSON-compatible format
 *   - Make sure it is a known schema object type
 *   - Make sure it is a singleton or belongs to a type with a root property
 *   - Add a reference  if appropriate
 *   - Add the object to the mock server's internal cache of objects, replacing any instance already there
 *   - Generate object creation or singleton update notifications if appropriate
 */
function createObject(server, newObject, skipNotification) {
    if (!newObject.type) {
        dxLog.fail('No type property found on object.', newObject);
    }

    var schema = server._schemasByName[newObject.type];
    if (!schema) {
        dxLog.fail(newObject.type + ' is not a known schema type.');
    }

    if (schema.singleton) {
        server._singletons[newObject.type] = newObject;

        if (!skipNotification) {
            postNotifications(server, [{
                type: 'SingletonUpdate',
                objectType: newObject.type
            }]);
        }
    } else {
        var rootType = getRootTypeForObject(schema, server._schemasByName);
        var shouldHaveReference = !!getPropDef(schema, 'reference', server._schemasByName);

        if (!rootType) {
            dxLog.fail(newObject.type + ' is not a type descended from one with a root property.');
        }

        server._objects[rootType] = server._objects[rootType] || [];
        server._objects[rootType].push(newObject);

        if (shouldHaveReference && !newObject.reference) {
            newObject.reference = newObject.type.toUpperCase() + '-' + server._nextReference;
            server._nextReference++;
        }

        // Notifications only make sense for an object with a reference
        if (newObject.reference && !skipNotification) {
            postNotifications(server, [{
                type: 'ObjectNotification',
                eventType: 'CREATE',
                objectType: newObject.type,
                object: newObject.reference
            }]);
        }

        return newObject.reference;
    }
}

/*
 * Updates a set of objects in the mock server.
 *
 * The parameters for this are discussed in the header comment to this file.
 *
 * Note:
 *   * All non-singleton objects MUST have a reference property set.
 *   * If the object type has a reference or is a singleton, then a corresponding UPDATE notification object will be
 *     automatically created unless skipNotifications is true.
 */
function updateObjects(server, objectsToUpdate, skipNotifications) {
    processArgumentsWithHandler(objectsToUpdate, skipNotifications, _.partial(updateObject, server));
}

function updateObject(server, newObject, skipNotification) {
    var schema = server._schemasByName[newObject.type];

    if (schema && schema.singleton) {
        updateObjectProperties(server, getSingleton(server, newObject.type), newObject);

        if (!skipNotification) {
            postNotifications(server, [{
                type: 'SingletonUpdate',
                objectType: newObject.type
            }]);
        }
    } else {
        if (!newObject.reference) {
            dxLog.fail('Can not update an object without at least a reference.');
        }
        var existing = getObject(server, newObject.reference);

        if (!existing) {
            dxLog.fail('There is no object with the reference ' + newObject.reference + ' to update.');
        }

        updateObjectProperties(server, existing, newObject);

        if (!skipNotification) {
            postNotifications(server, [{
                type: 'ObjectNotification',
                eventType: 'UPDATE',
                objectType: existing.type,
                object: existing.reference
            }]);
        }
    }
}

/*
 * Overlays the target with the new properties while being aware of the fact that objects that have no schema type
 * associated with them should be treated as an "atomic" value and not overlaid but rather replaced as a unit.
 */
function updateObjectProperties(server, targetObject, newProperties) {
    _.each(newProperties, function(propval, propname) {
        if (_.isObject(propval)) {
            var schema = server._schemasByName[targetObject.type];
            var propDef = getPropDef(schema, propname, server._schemasByName);

            if (propDef && propDef.$ref) {
                if (!_.isObject(targetObject[propname])) {
                    targetObject[propname] = {};
                }
                updateObjectProperties(server, targetObject[propname], propval);
                propval = targetObject[propname];
            }
        }
        targetObject[propname] = propval;
    });

    return targetObject;
}

/*
 * Deletes a set of objects in the mock server.
 *
 * The parameters for this are discussed in the header comment to this file.
 * In addition, if the objectsToDelete is an array, you can simply specify an array of references:
 *    deleteObjects(['REF-1', 'REF-2', 'REF-3'...])
 * This is, far and away, the most common use of this.
 *
 * Note:
 *   * This will throw an error if you try to delete a Singleton.
 *   * All objects MUST have a reference property set.
 *   * A corresponding DELETE notification object will be automatically created unless skipNotifications is true.
 */
function deleteObjects(server, objectsToDelete, skipNotifications) {
    processArgumentsWithHandler(objectsToDelete, skipNotifications, _.partial(deleteObject, server));
}

function deleteObject(server, doomedObjectOrRef, skipNotifications) {
    var targetReference = doomedObjectOrRef;

    if (_.isObject(doomedObjectOrRef)) {
        targetReference = doomedObjectOrRef.reference;
    }

    if (!targetReference) {
        dxLog.fail('No reference provided to identify the object to delete.');
    }

    if (isSingleton(server, targetReference)) {
        dxLog.fail('Can not delete singletons (' + targetReference + ' is a singleton).');
    }

    var deletedIt = _.find(server._objects, function(objectsArray) {
        return _.find(objectsArray, function(anObject, index) {
            if (anObject.reference === targetReference) {
                objectsArray.splice(index, 1);

                if (!skipNotifications) {
                    postNotifications(server, [{
                        type: 'ObjectNotification',
                        eventType: 'DELETE',
                        objectType: anObject.type,
                        object: anObject.reference
                    }]);
                }

                return true;
            }
        });
    });

    if (!deletedIt) {
        dxLog.fail('Could not find ' + targetReference + ' to delete it.');
    }
}

/*
 * Routine that process arguments to several input routines in a uniform way.  The arguments may be in one of two
 * forms:
 *    [{ ... properties ... }, { ... properties ... } ...]
 *  or
 *    {
 *        RootTypeName: [{ ... properties ... }, { ... properties ... } ...],
 *        RootTypeName: [{ ... properties ... }, { ... properties ... } ...],
 *        ...
 *    }
 * This will walk through each set of object properties, and call the specified handler with that set of properties
 * and the skipNotifications parameter.  In the case of the latter style, a type property will be added to each
 * individual object if it does not already have one.
 */
function processArgumentsWithHandler(objectsToProcess, skipNotifications, handler) {
    var copyOfObjects = deepClone(objectsToProcess);
    var result = [];

    if (_.isArray(copyOfObjects)) {
        for (var index = 0; index < copyOfObjects.length; index++) {
            result.push(handler(copyOfObjects[index], skipNotifications));
        }
    } else {
        _.each(copyOfObjects, function(objectOrArray, typeName) {
            if (_.isArray(objectOrArray)) {
                for (var ctr = 0; ctr < objectOrArray.length; ctr++) {
                    var anObject = objectOrArray[ctr];
                    anObject.type = anObject.type || typeName;
                    result.push(handler(anObject, skipNotifications));
                }
            } else {
                objectOrArray.type = objectOrArray.type || typeName;
                result.push(handler(objectOrArray, skipNotifications));
            }
        });
    }

    return result;
}

/*
 * Helper function to post an array of notifications.
 */
function postNotifications(server, notifications) {
    server.createObjects({
        Notification: notifications
    }, true);
}

/*
 * Returns the object with the specified reference, or undefined if no such object. If a type is specified, this may
 * use a faster algorithm to look up the object. This does not return singletons.
 */
function getObject(server, objectRef, typeName) {
    if (typeName) {
        var schema = server._schemasByName[typeName];
        if (!schema) {
            dxLog.fail(typeName + ' is not a known type.');
        }
        var rootTypeName = getRootTypeForObject(schema, server._schemasByName);
        if (!rootTypeName) {
            dxLog.fail('Can only ask for objects in collections with a root property with getObject().');
        }
        if (rootTypeName !== schema.name) {
            dxLog.fail('Must specify the root type (' + rootTypeName + ') if a type is specified to getObject().');
        }

        return _.find(server._objects[typeName], function(obj) {
            return obj.reference === objectRef;
        });
    }

    var matchedObject;
    _.find(server._objects, function(collection) {
        matchedObject = _.find(collection, function(anObject) {
            return anObject.reference === objectRef;
        });
        return matchedObject;
    });
    return matchedObject;
}

/*
 * Returns the collection of objects for the specified type. Note that the type must be a root type
 */
function getCollection(server, typeName) {
    var schema = server._schemasByName[typeName];
    if (!schema) {
        dxLog.fail(typeName + ' is not a known type.');
    }
    if (schema.singleton) {
        dxLog.fail(typeName + ' is a singleton type, not a collection type.');
    }
    var rootTypeName = getRootTypeForObject(schema, server._schemasByName);
    if (!rootTypeName) {
        dxLog.fail('Can only ask for collections with a root property.');
    }
    if (rootTypeName !== schema.name) {
        dxLog.fail('Must specify the root type (' + rootTypeName + ').');
    }

    return server._objects[typeName] || [];
}

/*
 * Returns the specified singleton from the server
 */
function getSingleton(server, typeName) {
    if (!isSingleton(server, typeName)) {
        dxLog.fail(typeName + ' is not a singleton type.');
    }

    if (!server._singletons[typeName]) {
        server._singletons[typeName] = {
            type: typeName
        };
    }

    return server._singletons[typeName];
}

function isSingleton(server, typeName) {
    var schema = server._schemasByName[typeName];
    return schema && schema.singleton;
}

/*
 * Removes all the elements from the specified collection. No notifications are generated.
 */
function clearCollection(server, typeName) {
    var collection = getCollection(server, typeName);
    collection.length = 0;
}

function getCollectionLength(server, typeName) {
    var collection = getCollection(server, typeName);
    return collection.length;
}

/*
 * Sets the 'standard (CRUD) object operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 *
 * You may override any of the standard operations that are supported for a given type. ServerCore already provides
 * default implementations of these handlers, but overriding these may be useful in certain cases, such as testing
 * various failure scenarious as well as being able to spy on these operations.
 * Any operations defined in the parameter will replace their equivalents already installed in the mock server, if any.
 */
function addStandardOpHandlers(server, operationHash) {
    if (!_.isObject(operationHash)) {
        dxLog.fail('Expected an object, but got ' + JSON.stringify(operationHash) + '.');
    }

    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addStandardOpHandler(server, type, oName, oFunc);
        });
    });
}

/*
 * Like addStandardOpHandlers(), but instead adds a single operation.
 */
function addStandardOpHandler(server, typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dxLog.fail('Expected a string as a type name, but got ' + JSON.stringify(typeName) + '.');
    }
    if (!_.isString(opName)) {
        dxLog.fail('Expected a string as an operation name, but got ' + JSON.stringify(opName) + '.');
    }
    if (!_.isFunction(opHandler)) {
        dxLog.fail('Expected a function for the handler, but got ' + JSON.stringify(opHandler) + '.');
    }
    if (!server._schemasByName[typeName]) {
        dxLog.fail(typeName + ' is not a schema type.');
    }
    if (!_.contains(STANDARD_OPERATONS, opName)) {
        dxLog.fail(opName + ' is not one of the standard operations (' + STANDARD_OPERATONS.join(', ') + ').');
    }
    if (!server._schemasByName[typeName][opName]) {
        dxLog.fail(opName + ' is not a standard operation on ' + typeName + '.');
    }

    server._customStdHandlers[typeName] = server._customStdHandlers[typeName] || {};
    server._customStdHandlers[typeName][opName] = opHandler;
}

/*
 * Sets the 'root operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 */
function addRootOpHandlers(server, operationHash) {
    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addRootOpHandler(server, type, oName, oFunc);
        });
    });
}

/*
 * Like addRootOpHandlers(), but instead adds a single operation.
 */
function addRootOpHandler(server, typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dxLog.fail('Expected a string as a type name, but got ' + JSON.stringify(typeName) + '.');
    }
    if (!_.isString(opName)) {
        dxLog.fail('Expected a string as an operation name, but got ' + JSON.stringify(opName) + '.');
    }
    if (!_.isFunction(opHandler)) {
        dxLog.fail('Expected a function for the handler, but got ' + JSON.stringify(opHandler) + '.');
    }
    if (!server._schemasByName[typeName]) {
        dxLog.fail(typeName + ' is not a schema type.');
    }
    if (!server._schemasByName[typeName].rootOperations || !server._schemasByName[typeName].rootOperations[opName]) {
        dxLog.fail(opName + ' is not a root operation on ' + typeName + '.');
    }

    server._customRootHandlers[typeName] = server._customRootHandlers[typeName] || {};
    server._customRootHandlers[typeName][opName] = opHandler;
}

/*
 * Adds one or more 'object operations' that can be on the mock server.
 *
 * The parameter has the form discussed in the files header comment.
 */
function addObjectOpHandlers(server, operationHash) {
    _.each(operationHash, function(ops, type) {
        _.each(ops, function(oFunc, oName) {
            addObjectOpHandler(server, type, oName, oFunc);
        });
    });
}

/*
 * Like addObjectOpHandlers(), but instead adds a single operation.
 */
function addObjectOpHandler(server, typeName, opName, opHandler) {
    if (!_.isString(typeName)) {
        dxLog.fail('Expected a string as a type name, but got ' + JSON.stringify(typeName) + '.');
    }
    if (!_.isString(opName)) {
        dxLog.fail('Expected a string as an operation name, but got ' + JSON.stringify(opName) + '.');
    }
    if (!_.isFunction(opHandler)) {
        dxLog.fail('Expected a function for the handler, but got ' + JSON.stringify(opHandler) + '.');
    }
    if (!server._schemasByName[typeName]) {
        dxLog.fail(typeName + ' is not a schema type.');
    }
    if (!server._schemasByName[typeName].operations || !server._schemasByName[typeName].operations[opName]) {
        dxLog.fail(opName + ' is not an object operation on ' + typeName + '.');
    }

    server._customObjHandlers[typeName] = server._customObjHandlers[typeName] || {};
    server._customObjHandlers[typeName][opName] = opHandler;
}

/*
 * Adds resources that can be called from a test.  In this case, a resource is an arbitrary string associated with
 * the full path portion of a URL.  This can be useful, for example, to register templates with the mock server that
 * can then be requested from a test.
 *
 * For example, this might be called with:
 * {
 *     '/test/template/basic.hjs': '<div id=basicTest></div>'
 * }
 */
function addResources(server, resourcesHash) {
    _.extend(server._resources, resourcesHash);
}

function HttpGet(server, url, payload) {
    return HttpOperation(server, 'GET', url, payload);
}

function HttpPost(server, url, payload) {
    return HttpOperation(server, 'POST', url, payload);
}

function HttpDelete(server, url, payload) {
    return HttpOperation(server, 'DELETE', url, payload);
}

function HttpOperation(server, method, url, payloadOrParams) {
    var result;
    var path = method + ':' + url;

    if (_.isString(payloadOrParams)) {
        payloadOrParams = JSON.parse(payloadOrParams);
    }

    // Look at the URL and identify candidate handlers.
    var objectOpMatch = OBJECT_OPERATION_REGX.exec(path);
    var objectOpPath = objectOpMatch ? objectOpMatch[1] + INLINE_REF + objectOpMatch[3] : '';
    var objectOpRef = objectOpMatch ? objectOpMatch[2] : '';
    var objectOpHandler = server._builtinHandlers[objectOpPath];

    var objectRUDMatch = OBJECT_READ_UPDATE_DELETE_REGEX.exec(path);
    var objectRUDPath = objectRUDMatch[1] + TRAILING_REF;
    var objectRUDRef = objectRUDMatch[2];
    var objectRUDHandler = server._builtinHandlers[objectRUDPath];

    if (objectOpHandler) {
        result = objectOpHandler(objectOpRef, payloadOrParams, Result, server);
    } else if (server._builtinHandlers[path]) {
        result = server._builtinHandlers[path](payloadOrParams, Result, server);
    } else if (objectRUDHandler) {
        result = objectRUDHandler(objectRUDRef, payloadOrParams, Result, server);
    } else if (server._resources[url] && method === 'GET') {
        result = new Result(200, server._resources[url]);
    } else {
        result = new Result(server.UNKNOWN_URL_STATUS, null);
    }

    // If a handler returned a non-Result, assume it is an OkResult body, and return that instead
    if (!(result instanceof Result)) {
        result = new Result.OkResult(result || null);
    }

    return result;
}

function buildHandlersForSingletonSchema(server, schema) {
    var singletoneType = schema.name;

    if (schema.read) {
        server._builtinHandlers['GET:' + schema.root] = function builtinSingleReadHandler(parameters, Result, server) {
            var customHandlers = server._customStdHandlers[singletoneType];
            if (customHandlers && customHandlers.read) {
                return customHandlers.read(parameters, Result, server) || new Result.OkResult({});
            }

            return new Result.OkResult(getSingleton(server, singletoneType));
        };
    }

    /*
     * Singletons can have only an update or a create, but not both (there is no reference property to distinguish them
     * as there is with ordinary objects)
     */
    if (schema.update || schema.create) {
        server._builtinHandlers['POST:' + schema.root] = function builtinSingleUpdateCreate(payload, Result, server) {
            var customHandlers = server._customStdHandlers[singletoneType];

            payload = deepClone(payload) || {};
            payload.type = singletoneType;

            if (schema.create) {
                if (customHandlers && customHandlers.create) {
                    return customHandlers.create(payload, Result, server);
                }

                createObject(server, payload);
            } else {
                if (customHandlers && customHandlers.update) {
                    return customHandlers.update(payload, Result, server);
                }

                updateObject(server, payload);
            }

            return new Result.OkResult(null);
        };
    }

    buildRootOperationHandlers(server, schema);
}

function buildHandlersForCollectionSchema(server, schema) {
    buildStandardOperationHandlers(server, schema);
    buildRootOperationHandlers(server, schema);
    buildOperationHandlers(server, schema);
}

function buildStandardOperationHandlers(server, schema) {
    var methodAndUrl;
    var typeName = schema.name;

    if (schema.list) {
        methodAndUrl = 'GET:' + schema.root;

        server._builtinHandlers[methodAndUrl] = function builtinListHandler(parameters, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];

            if (customHandlers && customHandlers.list) {
                var result = customHandlers.list(parameters, Result, server);

                // Special case. If the handler returned nothing or a non-result, return a ListResult
                result = result || [];
                if (!(result instanceof Result)) {
                    return new Result.ListResult(result);
                }

                return result;
            }

            var collection = getCollection(server, typeName);

            if (server._filters[typeName]) {
                collection = server._filters[typeName](collection, parameters || {}, {
                    type: typeName,
                    server: server,
                    utils: server._filterUtils
                });
            }

            return new Result.ListResult(collection);
        };
    }

    if (schema.create) {
        methodAndUrl = 'POST:' + schema.root;

        server._builtinHandlers['POST:' + schema.root] = function builtinCreateHandler(payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            var targetType = typeName;
            var payloadSchema;
            var rootTypeName;

            if (customHandlers && customHandlers.create) {
                return customHandlers.create(payload, Result, server);
            }

            if (payload && payload.type) {
                targetType = payload.type;
            }
            payloadSchema = server._schemasByName[targetType];
            if (!payloadSchema) {
                dxLog.fail(targetType + ' is not a known schema type.');
            }
            rootTypeName = getRootTypeForObject(payloadSchema, server._schemasByName);
            if (rootTypeName !== typeName) {
                dxLog.fail('Trying to create a ' + typeName + ' but received a payload of type ' + payload.type +
                    '. Use addStandardOpHandlers() to roll your own create logic.');
            }

            var objectsToCreate = {};
            objectsToCreate[typeName] = [payload];

            var references = createObjects(server, objectsToCreate);

            return new Result.OkResult(references[0]);
        };
    }

    if (schema.read) {
        methodAndUrl = 'GET:' + schema.root + TRAILING_REF;

        server._builtinHandlers[methodAndUrl] = function builtinReadHandler(reference, payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            if (customHandlers && customHandlers.read) {
                return customHandlers.read(reference, payload, Result, server) || new Result.OkResult({});
            }

            var obj = getObject(server, reference, typeName);
            if (!obj) {
                return new Result.MissingObjResult(typeName, reference, 'read');
            }

            return new Result.OkResult(obj);
        };
    }

    if (schema.update) {
        methodAndUrl = 'POST:' + schema.root + TRAILING_REF;
        server._builtinHandlers[methodAndUrl] = function builtinUpdateHandler(reference, payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            if (customHandlers && customHandlers.update) {
                return customHandlers.update(reference, payload, Result, server);
            }

            if (!getObject(server, reference, typeName)) {
                return new Result.MissingObjResult(typeName, reference, 'update');
            }

            // 'reference' is inferred by the url and must not be part of the data already.
            payload = deepClone(payload);
            payload.reference = reference;

            updateObjects(server, [payload]);

            return new Result.OkResult(null);
        };
    }

    if (schema.delete) {
        methodAndUrl = 'DELETE:' + schema.root + TRAILING_REF;

        server._builtinHandlers[methodAndUrl] = function builtinDeleteHandler(reference, payload, Result, server) {
            var customHandlers = server._customStdHandlers[typeName];
            if (customHandlers && customHandlers.delete) {
                return customHandlers.delete(reference, payload, Result, server);
            }

            if (!getObject(server, reference, typeName)) {
                return new Result.MissingObjResult(typeName, reference, 'delete');
            }

            deleteObjects(server, [reference]);

            return new Result.OkResult(null);
        };
    }
}

function buildOperationHandlers(server, schema) {
    _.each(schema.operations, function(opDef, operationName) {
        var httpMethod = opDef.payload ? 'POST' : 'GET';
        var methodAndUrl = httpMethod + ':' + schema.root + INLINE_REF + operationName;

        server._builtinHandlers[methodAndUrl] = function builtinObjHandler(objectRef, payloadOrParams, Result, server) {
            if (!getObject(server, objectRef, schema.name)) {
                return new Result.MissingObjResult(schema.name, objectRef, operationName);
            }

            var customHandlers = server._customObjHandlers[schema.name];
            if (customHandlers && customHandlers[operationName]) {
                return customHandlers[operationName](objectRef, payloadOrParams, Result, server);
            }

            dxLog.fail('Test called ' + schema.name + '.' + operationName + ', but no handler registered for it.');
        };
    });
}

function buildRootOperationHandlers(server, schema) {
    _.each(schema.rootOperations, function(opDef, operationName) {
        var httpMethod = opDef.payload ? 'POST' : 'GET';
        var methodAndUrl = httpMethod + ':' + schema.root + '/' + operationName;

        server._builtinHandlers[methodAndUrl] = function builtinRootOpHandler(payloadOrParams, Result, server) {
            var customHandlers = server._customRootHandlers[schema.name];
            if (customHandlers && customHandlers[operationName]) {
                return customHandlers[operationName](payloadOrParams, Result, server);
            }

            dxLog.fail('Test called ' + schema.name + '.' + operationName + ', but no handler registered for it.');
        };
    });
}

function Result(statusCode, data) {
    var self = this;

    if (!(self instanceof Result)) {
        dxLog.fail('Must call Result() with new.');
    }

    self.statusCode = statusCode;
    self.data = data;
}

function OkResult(data) {
    if (!(this instanceof OkResult)) {
        dxLog.fail('Must call Result.OkResult() with new.');
    }

    return new Result(200, {
        type: 'OKResult',
        result: data
    });
}

function ListResult(data) {
    if (!_.isArray(data)) {
        dxLog.fail('Must call Result.ListResult() with an array.');
    }
    if (!(this instanceof ListResult)) {
        dxLog.fail('Must call Result.ListResult() with new.');
    }

    return new Result(200, {
        type: 'ListResult',
        result: data
    });
}

function ErrorResult(statusCode, error) {
    if (!(this instanceof ErrorResult)) {
        dxLog.fail('Must call Result.ErrorResult() with new.');
    }

    return new Result(statusCode, {
        type: 'ErrorResult',
        status: 'ERROR',
        error: error
    });
}

function MissingObjResult(type, ref, operation) {
    if (!(this instanceof MissingObjResult)) {
        dxLog.fail('Must call Result.MissingObjResult() with new.');
    }

    return new ErrorResult(404, {
        type: 'APIError',
        details: type + '/' + ref + ' could not be found for ' + operation + '.',
        id: 'object.missing'
    });
}

_.extend(Result, {
    OkResult: OkResult,
    ListResult: ListResult,
    ErrorResult: ErrorResult,
    MissingObjResult: MissingObjResult
});

// Returns the property definition if instances of the specified schema have a specific property, undefined otherwise
function getPropDef(schema, propName, schemasByName) {
    if (schema.properties && schema.properties[propName]) {
        return schema.properties[propName];
    }

    if (schema.extends && schema.extends.$ref) {
        return getPropDef(schemasByName[schema.extends.$ref], propName, schemasByName);
    }
}

// Returns the name of the root type for the specified schema, or undefined.
function getRootTypeForObject(schema, schemasByName) {
    if (schema.root) {
        return schema.name;
    }

    if (schema.extends && schema.extends.$ref) {
        return getRootTypeForObject(schemasByName[schema.extends.$ref], schemasByName);
    }
}

function processSchemas(server, schemas) {
    function fixName(schemaKey) {
        return schemaKey.replace(/\.json$/, '')
            .replace(/-/g, '_')
            .replace(/\//g, '');
    }

    // Fix all the names for all the schemas, and store them by name
    _.each(schemas, function(schema, schemaKey) {
        // don't modify the original schema
        var schemaCopy = deepClone(schema);
        if (!schemaCopy.name) {
            schemaCopy.name = fixName(schemaKey);
        }
        server._schemasByName[schemaCopy.name] = schemaCopy;
    });

    // Fix internal references to the schemas and build the callback handlers for all operations.
    _.each(server._schemasByName, function(schema) {
        if (schema.extends) {
            schema.extends.$ref = fixName(schemas[schema.extends.$ref].name);
        }

        if (schema.root) {
            if (schema.singleton) {
                buildHandlersForSingletonSchema(server, schema);
            } else {
                buildHandlersForCollectionSchema(server, schema);
            }
        }
    });
}

/*
 * Does a deep clone of the specified object, but replaces Date instances with .toJSON() equivalents, and
 * undefined with null.
 */
function deepClone(obj) {
    var result = obj;

    if (_.isArray(obj)) {
        result = [];
        for (var index = 0; index < obj.length; index++) {
            result[index] = deepClone(obj[index]);
        }
    } else if (_.isObject(obj)) {
        if (_.isDate(obj)) {
            result = obj.toJSON();
        } else {
            result = {};
            _.each(obj, function(value, index) {
                if (_.isUndefined(value)) {
                    value = null;
                }
                result[index] = deepClone(value);
            });
        }
    }

    return result;
}

/*
 * Return a function that does a deep clone of the return value
 */
function deepCloneReturn(func, server) {
    return function() {
        // All our functions take the server as their first argument.
        Array.prototype.unshift.call(arguments, server);
        return deepClone(func.apply(server, arguments));
    };
}

function reset(server) {
    server._singletons = {};
    server._objects = {};
    server._nextReference = START_REF;
    server._resources = {};
    server._customObjHandlers = {};   // { type: { op: function() } }
    server._customRootHandlers = {};
    server._customStdHandlers = {};
}

/*
 * Document structure of schemas
 */
function ServerCore(schemas, filters) {
    var self = this;
    if (!(self instanceof ServerCore)) {
        dxLog.fail('Must call ServerCore() with new.');
    }
    if (!schemas) {
        dxLog.fail('Must pass a map of schemas when constructing a ServerCore.');
    }

    self._schemasByName = {};
    self._builtinHandlers = {}; // 'HTTPMMETHOD:url': function()
    self._filters = filters || {};
    reset(self);

    processSchemas(this, schemas);

    self._filterUtils = new MockFilterUtils(self._schemasByName);

    _.extend(self, {
        UNKNOWN_URL_STATUS: 1000,
        createObjects: _.partial(createObjects, self),
        updateObjects: _.partial(updateObjects, self),
        deleteObjects: _.partial(deleteObjects, self),
        getObject: deepCloneReturn(getObject, self),
        getSingleton: deepCloneReturn(getSingleton, self),
        getCollection: deepCloneReturn(getCollection, self),
        clearCollection: _.partial(clearCollection, self),
        getCollectionLength: _.partial(getCollectionLength, self),
        addStandardOpHandlers: _.partial(addStandardOpHandlers, self),
        addStandardOpHandler: _.partial(addStandardOpHandler, self),
        addRootOpHandlers: _.partial(addRootOpHandlers, self),
        addRootOpHandler: _.partial(addRootOpHandler, self),
        addObjectOpHandlers: _.partial(addObjectOpHandlers, self),
        addObjectOpHandler: _.partial(addObjectOpHandler, self),
        addResources: _.partial(addResources, self),
        GET: deepCloneReturn(HttpGet, self),
        POST: deepCloneReturn(HttpPost, self),
        DELETE: deepCloneReturn(HttpDelete, self),
        reset: _.partial(reset, self)
    });
}

module.exports = ServerCore;

},{"./MockFilterUtils.js":13,"dxLog":"dxLog","underscore":"underscore"}],15:[function(require,module,exports){
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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global $, require, module */

'use strict';

var dxLog = require('dxLog');
var _ = require('underscore');

var AbstractServer = require('./AbstractServer.js');

/*
 * Defines a MockServer which responds to $.ajax calls, and then stores results until a caller/test calls respond().
 * This allows tests to make use of asynchronous behavior without actually creating asynchronous tests.
 *
 * An example use is:
 *
 *    it('does something wonderful', function() {
 *        var mockServer = new MockServer(MY_SCHEMAS);
 *        mockServer.start();
 *
 *        var promise = dxData.getServerModelPromise('CONTAINER-1', 'Container');
 *        promise.then(function() {});
 *
 *        // Note that this has "sent" an "asynchronous" request to the MockServer
 *        assert(promise).not.toHaveBeenCalled();
 *
 *        mockServer.respond(); // Tell the server to deliver the "asynchronous" results to the client
 *
 *        expect(resultSpy).toHaveBeenCalled();
 *    });
 *
 * Note that this MockServer is a ServerCore instance, so all the functions on ServerCore to add, update etc. are here
 * as well.
 *
 * It is notable that the respond() function can take a function with the following signature:
 *     respondFilter(response, stash)
 * response is a Response object which has these interesting properties:
 *    index     The number (starting at 1) of the response during the current respond() call
 *    getData() Returns the data to be returned to the client
 *    deliver() Tells the mock server to deliver this response to the client
 *    stash()   Tells the mock server to store this response for future handling (see "stash", below)
 *    delay(ms) Tells the mock server to deliver this response after "ms" milliseconds (caller must still call respond)
 * stash is an object that contains any responses that have been previously stash()'ed during this test. You can:
 *    getSize()    Returns how many responses are in the stash
 *    deliverAll() Have all the responses in the stash returned to the client
 *
 * Note that if a respondFilter is provided, if there are no already-existing responses waiting to be delivered, and
 * there are items in the stash, the responseFilter will be called with the response object set to undefined.  This
 * allows you to have the opportunity to work with the stash despite the absence of pending responses.
 */

/*
 * Response is the "public interface" to results that is given to respond() callers that pass in a filter function.
 * This provides functions for all the things that can be done with the result. It does rely on intimate access to
 * the mock server's internals.
 */
function Response(result, resultCount, server) {
    var self = this;
    self._result = result;
    self._server = server;
    self._delivered = false;
    self._handled = undefined;
    self.index = resultCount;
}

function getData() {
    var self = this;
    return self._result.data;
}

function deliver() {
    var self = this;
    self._assertNotHandled();

    self._delivered = true;
    self._handled = 'delivered';
    self._server._deliverResult(self._result);
}

function delay(milliseconds) {
    var self = this;
    self._assertNotHandled();

    self._handled = 'delayed';
    self._server._timeoutResults.push(self._result);
    self._server._timeoutIds.push(setTimeout(delayedDelivery.bind(self), milliseconds));
}

function stash() {
    var self = this;
    self._assertNotHandled();

    self._handled = 'stashed';
    self._server._stash._addResult(self._result);
}

function delayedDelivery() {
    var self = this;
    var index = self._server._timeoutResults.indexOf(self._result);

    self._server._timeoutResults.splice(index, 1);
    handleResult(self._server, self._result);
}

function assertNotHandled() {
    var self = this;
    if (self._handled) {
        dxLog.fail('Already ' + self._handled + ' this response.');
    }
}

_.extend(Response.prototype, {
    _assertNotHandled: assertNotHandled,
    getData: getData,
    deliver: deliver,
    delay: delay,
    stash: stash
});

/*
 * A Stash is a collection of results that a respond() filter function has decided it doesn't want to have delivered
 * yet.  It persists across respond() calls, but its contents are delivered to the client when the server is reset.
 */
function Stash(server) {
    var self = this;
    self._stash = [];
    self._server = server;
}

function getSize() {
    var self = this;
    return self._stash.length;
}

function addResult(result) {
    var self = this;
    self._stash.push(result);
}

function deliverAll() {
    var self = this;
    var stashCopy = self._stash;
    self._stash = [];
    _.each(stashCopy, function(item) {
        self._server._deliverResult(item);
    });
    $.event.trigger('ajaxComplete');
}

_.extend(Stash.prototype, {
    _addResult: addResult,
    getSize: getSize,
    deliverAll: deliverAll
});

function handleUnknownUrl(server, method, url, settings) {
    /*
     * An unknown URL via a GET is not that uncommon. Some i18n libraries routinely ask for things that don't
     * exit. In these cases, we just want to give them a 404.
     */
    if (method === 'GET') {
        server._handleResult(server._addToResult({ statusCode: 404 }, settings, server._ajaxCallId));
        return;
    }
    /*
     * Logically, this is a 404 situation.  But, also in theory this really shouldn't ever happen.  A thrown error
     * makes it clearer that the developer has done something very un-ok.
     */
    dxLog.fail('The requested resource is not available: ' + method + ':' + url);
}

/*
 * Unless the request was a sync one, the MockServer merely queues results until respond() is called.
 */
function handleResult(server, result) {
    server._reportDebug(result.callId, 'Result: Status ' + result.statusCode, result.data);

    if (result.async === false) {
        server._deliverResult(result);
    } else {
        server._pendingResults.push(result);
    }
}

/*
 * Deliver any queued results.  If a filter function is provided, give it the results first to decide if they should
 * be returned.
 */
function respond(server, filterFunction) {
    if (!_.isUndefined(filterFunction) && !_.isFunction(filterFunction)) {
        dxLog.fail('Filter function, if provided, must be a function.');
    }
    var resultCount = 0;
    var resultSent;

    server._processNotifications();

    if (filterFunction && server._pendingResults.length === 0 && server._stash.getSize() > 0) {
        filterFunction(undefined, server._stash);
    }

    while (server._pendingResults.length > 0) {
        var result = server._pendingResults.shift();
        resultCount++;

        if (filterFunction) {
            var response = new Response(result, resultCount, server);
            filterFunction(response, server._stash);
            resultSent = response._delivered;
            if (!response._handled) {
                dxLog.fail('Must do something with the response.');
            }
        } else {
            resultSent = true;
            server._deliverResult(result);
        }

        // Check if there are any notifications which should be returned.
        server._processNotifications();
    }

    /*
     * notify the system that an ajax call returned. Technically this should be done on every callback, but that drags
     * down our test performance considerably, and doing it once per respond() seems sufficient.
     */
    if (resultSent) {
        $.event.trigger('ajaxComplete');
    }
}

/*
 * This forces a thorough respond, which means any pending longpolls are responded to (with an empty array if
 * necessary), any stashed values are returned, any values waiting for timeouts are also returned.  This was designed
 * to be used in test cleanup to make sure the server is done with any necesary work.
 */
function forceRespond(server) {
    /*
     * If a reset is being done while notification system is active, we want to allow a new longpoll to come in while
     * we are resetting.
     */
    var pendingLongpolls = server._pendingLongpolls.slice(0);
    server._pendingLongpolls = [];
    _.each(pendingLongpolls, function(result) {
        server._deliverResult(_.extend(result, {
            statusCode: 200,
            data: {
                type: 'ListResult',
                result: []
            }
        }));
    });
    _.each(server._timeoutResults, server._deliverResult);
    _.each(server._timeoutIds, clearTimeout);
    server._stash.deliverAll();
    server.respond();

    server._pendingResults = [];
    server._timeoutIds = [];
    server._timeoutResults = [];
    server._ajaxCallId = 0;
}

function MockServer(schemas, filters) {
    var self = this;
    if (!(self instanceof MockServer)) {
        dxLog.fail('Must call MockServer() with new.');
    }
    if (!_.isObject(schemas)) {
        dxLog.fail('Must pass a map of schemas when constructing a server.');
    }

    var server = new AbstractServer(schemas, filters);
    var serverReset = server.reset;

    _.extend(server, {
        _pendingResults: [],
        _timeoutIds: [],
        _timeoutResults: [],
        _stash: new Stash(server),
        _forceRespond: _.partial(forceRespond, server),
        _handleUnknownUrl: _.partial(handleUnknownUrl, server),
        _handleResult: _.partial(handleResult, server),
        respond: _.partial(respond, server),
        reset: function() {
            serverReset.apply(server);
            server._forceRespond();
        }
    });

    return server;
}

module.exports = MockServer;

},{"./AbstractServer.js":11,"dxLog":"dxLog","underscore":"underscore"}],16:[function(require,module,exports){
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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global dx */

'use strict';

module.exports = {
    INEQUALITY_TYPES: {
        STRICT: 'STRICT',
        NON_STRICT: 'NON-STRICT'
    },
    LIST_TYPES: {
        NONE:   'NONE',
        UBER:   'UBER',
        CUSTOM: 'CUSTOM'
    }
};

},{}],17:[function(require,module,exports){
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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global module, console */

'use strict';

var dxLog = require('dxLog');

/*
 * Utility routines used commonly across dxData
 */

/*
 * Shortcut for checking if a value is either null or undefined
 */
function isNone(value) {
    return value === null || value === undefined;
}

/*
 * Returns a new object that is a deep clone of the input object.
 */
function deepClone(obj) {
    var result = obj;
    
    if (obj instanceof Array) {
        result = [];
        for (var index = 0; index < obj.length; index++) {
            result[index] = deepClone(obj[index]);
        };
    } else if (obj instanceof Object) {
        if (obj instanceof Date) {
            result = new Date(obj.getTime());
        } else {
            result = {};
            for (var key in obj) {
                result[key] = deepClone(obj[key]);
            };
        }
    }
    
    return result;
}

/*
 * Wrapper function for jquery $.ajax function
 *    config - $.ajax configuration object.
 */
function ajaxCall(config) {
    if (config && config.url) {
        config.type = config.type || 'GET';
        config.contentType = config.contentType || 'application/json';
        config.dataType = config.dataType || 'json';
        
        config.xhrFields = config.xhrFields || {
            withCredentials: true
        };
        
        config.success = config.success || function(d) {
            dxLog.debug(d);
        };
        
        config.error = config.error || function(e) {
            dxLog.debug(e);
        };
        
        config.cache = config.cache || false;
        
        try {
            $.ajax(config);
        } catch (e) {s
            dxLog.fail(e.message);
        }
    } else {
        dxLog.fail('Invalid configuration for jQuery ajax call. Unable to complete the operation.');
    }
}

module.exports = {
    isNone: isNone,
    deepClone: deepClone,
    ajaxCall: ajaxCall
};

},{"dxLog":"dxLog"}],"dxData":[function(require,module,exports){
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
 * Copyright (c) 2013, 2014 by Delphix. All rights reserved.
 */

/*global module */

'use strict';

module.exports = {
    DataSystem: require('../layer3/api.js'),
    constant: require('../util/constant.js'),
};


},{"../layer3/api.js":8,"../util/constant.js":16}],"dxLog":[function(require,module,exports){
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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*global module, console */

'use strict';

module.exports = require('../log/log.js');

},{"../log/log.js":10}]},{},[11,12,13,14,15])
//# sourceMappingURL=dxDataMockServer.js.map
