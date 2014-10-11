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
 * Copyright (c) 2014 by Delphix. All rights reserved.
 */

'use strict'

/*global Backbone, dx, buzzrData */

/*
 * Define a component which presents a list of buzzes
 */
var BuzzView = Backbone.View.extend({
    initialize: function(buzz) {
        var self = this;
        self.buzz = buzz;
        
        var promise = buzzrData.getServerModelPromise(buzz.get("who"), "User");
        promise.done(function(user) {
            self.writer = user;
            self.writer.on("change", self.render.bind(self));
            self.render();
        });
        self.buzz.on('change', self.render.bind(self));
        self.render();
    },
    
    render: function() {
        var self = this;
        
        self.$el.empty();
        var domElements = self.buzzTemplate({
                'messageText' : self.buzz.get('text'),
                'when' : self.buzz.get('when'),
                'name' : self.writer ? self.writer.get('name') : ''
            });
        self.$el.append(domElements);
    },

    buzzTemplate: _.template('<div>' +
        '<div>' +
            '<span class="buzz-writer"><%= name %></span>   <span class="buzz-time">(<%= when.toLocaleString() %>)</span>' +
        '</div>' +
        '<div><%= messageText %></div>' +
    '</div>'),
});