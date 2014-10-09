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

/*global Backbone, dx, $, buzzrData */

/*
 * Define a component which allows the user to type in a new buzz and send it.
 */
var BuzzInputView = Backbone.View.extend({
    initialize: function() {
        var self = this;
        self.render();
    },
    
    tagName: 'div',
    
    attributes: {
        'class': 'buzz-block'
    },

    events: {
        'click .sid-buzz-button': 'sendBuzz'
    },
    
    render: function() {
        var self = this;
        
        self.$el.append(self.template());
    },
    
    sendBuzz: function() {
        var input = $('.sid-buzz-input').val();
        
        var buzz = buzzrData.newClientModel('Buzz');
        buzz.set('text', input);
        buzzrData.rootOps.Buzz.$$create(buzz, {
            success: function() {
                $('.sid-buzz-input').val("");
                $('.sid-buzz-input').focus();
            }
        });
    },

    template: _.template(
        '<input type="text" ' +
            'autofocus ' +
            'class="sid-buzz-input buzz-field" '+
            'placeholder="Buzz your friends!">' +
        '</input> ' +
        '<button class="sid-buzz-button">Buzz</button>')
});