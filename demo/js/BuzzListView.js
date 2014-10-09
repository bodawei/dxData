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
var BuzzListView = Backbone.View.extend({
    initialize: function() {
        var self = this;
        
        self.collection = buzzrData.getServerCollection('Buzz');
        self.collection.$$list();
        self.collection.on('add remove reset', self.render.bind(self));
    },
    
    render: function() {
        var self = this;
        
        self.$el.empty();
        var rowNum = 0;
        self.collection.each(function (buzz) {
            var domElements = self.buzzTemplate({
                'messageText' : buzz.get('text'),
                'row': 'row' + (rowNum %2)
            });
            self.$el.append(domElements);
            rowNum ++;
        })
    },

    buzzTemplate: _.template('<div class="row <%= row %>"><%= messageText %></div>'),
});