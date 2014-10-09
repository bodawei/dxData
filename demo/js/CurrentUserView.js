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
 * Define a component which the name of the current user and lets the user change it
 */
var CurrentUserView = Backbone.View.extend({
    initialize: function() {
        var self = this;
        
        self.$el.append(self.template());
        self.$el.append(self.editTemplate());
        var promise = buzzrData.rootOps.User.$currentUser();
        promise.done(function(okResult) {
            self.user = okResult.get('result');
            self.user.on('change', self.render.bind(self));
            self.render();
        });
    },
    
    tagName: 'span',
    
    attributes: {
        'class': 'input-box'
    },
    
    events: {
        'click .sid-name': 'editName',
        'click .sid-send-name': 'sendName',
        'click .sid-cancel-name': 'cancelName',
    },
    
    render: function() {
        var self = this;
        if (self.user) {
            $('.sid-name').html(self.user.get('name'));
        }
    },
    
    editName: function() {
        var self = this;

        $('.sid-name').hide();
        $('.sid-name-editing').show();
        $('.sid-name-editing input')[0].select();
        $('.sid-name-input').val(self.user.get('name'));
    },

    sendName: function() {
        var self = this;

        self.user.$$update({
            name: $('.sid-name-input').val()
        });
        self.cancelName();
    },

    cancelName: function() {
        var self = this;

        $('.sid-name').show();
        $('.sid-name-editing').hide();
        $('.sid-name-input').val('');
    },

    template: _.template('<span class="sid-name name-input"></span>'),
    
    editTemplate: _.template(
        '<span class="sid-name-editing" ' +
            'style="display:none">' +
            '<input type="text" ' +
                'class="sid-name-input">' +
            '</input>' +
            '<button class="sid-send-name">Update</button>' +
            '<button class="sid-cancel-name">Cancel</button>' +
        '</span>')
});