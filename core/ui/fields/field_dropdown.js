/**
 * Visual Blocks Editor
 *
 * Copyright 2012 Google Inc.
 * http://blockly.googlecode.com/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Dropdown input field.  Used for editable titles and variables.
 * In the interests of a consistent UI, the toolbox shares some functions and
 * properties with the context menu.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.FieldDropdown');

goog.require('Blockly.Field');
goog.require('goog.array');

/**
 * Class for an editable dropdown field.
 * @param {(!Array.<string>|!Function)} menuGenerator An array of options
 *     for a dropdown list, or a function which generates these options.
 * @param {Function} opt_changeHandler A function that is executed when a new
 *     option is selected.
 * @param {boolean} opt_alwaysCallChangeHandler Whether or not to call
 *     opt_changeHandler when the value is set by something other than UI
 *     interaction
 * @extends {Blockly.Field}
 * @constructor
 */
Blockly.FieldDropdown = function(
  menuGenerator,
  opt_changeHandler,
  opt_alwaysCallChangeHandler
) {
  this.menuGenerator_ = menuGenerator || [
    [
      Blockly.FieldDropdown.NO_OPTIONS_MESSAGE,
      Blockly.FieldDropdown.NO_OPTIONS_MESSAGE
    ]
  ];
  this.changeHandler_ = opt_changeHandler;
  this.alwaysCallChangeHandler_ = !!opt_alwaysCallChangeHandler;
  this.trimOptions_();
  var firstTuple = this.getOptions()[0];
  this.value_ = firstTuple[1];

  // Add dropdown arrow: "option ▾" (LTR) or "▾ אופציה" (RTL)
  this.arrow_ = Blockly.createSvgElement(
    'tspan',
    {class: 'blocklyArrow'},
    null
  );
  this.arrow_.appendChild(
    document.createTextNode(Blockly.RTL ? '\u25BC ' : ' \u25BC')
  );

  // Call parent's constructor.
  Blockly.FieldDropdown.superClass_.constructor.call(this, firstTuple[0]);
};
goog.inherits(Blockly.FieldDropdown, Blockly.Field);

/**
 * Horizontal distance that a checkmark overhangs the dropdown.
 */
Blockly.FieldDropdown.CHECKMARK_OVERHANG = 25;

/**
 * Message displayed if no options have been configured yet
 * @type {string}
 */
Blockly.FieldDropdown.NO_OPTIONS_MESSAGE = 'uninitialized';

/**
 * Mouse cursor style when over the hotspot that initiates the editor.
 */
Blockly.FieldDropdown.prototype.CURSOR = 'pointer';

/**
 * Create a dropdown menu under the text.
 * @private
 */
Blockly.FieldDropdown.prototype.showEditor_ = function(container) {
  this.showWidgetDiv_();
  var thisField = this;

  function callback(e) {
    var menuItem = e.target;
    if (menuItem) {
      var value = menuItem.getValue();
      if (thisField.changeHandler_ && !thisField.alwaysCallChangeHandler_) {
        // Call any change handler, and allow it to override. This happens
        // inside setValue if alwaysCallChangeHandler_ is true.
        var override = thisField.changeHandler_(value);
        if (override !== undefined) {
          value = override;
        }
      }
      if (value !== null) {
        thisField.setValue(value);
      }
    }
    Blockly.WidgetDiv.hideIfOwner(thisField);
  }

  this.menu_ = new goog.ui.Menu();
  var options = this.getOptions();
  for (var x = 0; x < options.length; x++) {
    var text = options[x][0]; // Human-readable text.
    var value = options[x][1]; // Language-neutral value.
    var menuItem = new goog.ui.MenuItem(text);
    menuItem.setValue(value);
    menuItem.setCheckable(true);
    this.menu_.addItem(menuItem);
    menuItem.setChecked(value === this.value_);
  }
  goog.events.listen(this.menu_, goog.ui.Component.EventType.ACTION, callback);
  var div = container || Blockly.WidgetDiv.DIV;

  // IE will scroll the bottom of the page into view to show this element
  // before we move it, so hide it until we've repositioned.
  div.style.visibility = 'hidden';
  this.menu_.render(div);
  this.menu_.setAllowAutoFocus(true);
  var menuDom = this.menu_.getElement();
  Blockly.addClass_(menuDom, 'blocklyDropdownMenu');
  // display menu items without shortcuts
  Blockly.addClass_(menuDom, 'goog-menu-noaccel');
  (container || menuDom).style.borderColor =
    'hsla(' +
    this.sourceBlock_.getColour() +
    ', ' +
    this.sourceBlock_.getSaturation() * 100 +
    '%, ' +
    this.sourceBlock_.getValue() * 100 +
    '%' +
    ', 0.5)';
  menuDom.style.overflowY = 'auto';
  menuDom.style['max-height'] = '265px';

  this.positionWidgetDiv();

  div.style.visibility = 'visible';
};

/**
 * @override
 */
Blockly.FieldDropdown.prototype.positionWidgetDiv = function() {
  var windowSize = goog.dom.getViewportSize();
  var scrollOffset = goog.style.getViewportPageOffset(document);
  var xy = Blockly.getAbsoluteXY_(
    /** @type {!Element} */ (this.borderRect_),
    this.getRootSVGElement_()
  );
  var borderBBox = this.borderRect_.getBBox();
  var menuSize = goog.style.getSize(this.menu_.getElement());

  // Flip menu vertically if off the bottom.
  if (
    xy.y + menuSize.height + borderBBox.height >=
    windowSize.height + scrollOffset.y
  ) {
    xy.y -= menuSize.height;
  } else {
    xy.y += borderBBox.height;
  }

  if (Blockly.RTL) {
    xy.x += borderBBox.width;
    xy.x += Blockly.FieldDropdown.CHECKMARK_OVERHANG; // Width of checkmark.
    // Don't go offscreen left.
    if (xy.x < scrollOffset.x + menuSize.width) {
      xy.x = scrollOffset.x + menuSize.width;
    }
  } else {
    xy.x -= Blockly.FieldDropdown.CHECKMARK_OVERHANG; // Width of checkmark.
    // Don't go offscreen right.
    if (xy.x > windowSize.width + scrollOffset.x - menuSize.width) {
      xy.x = windowSize.width + scrollOffset.x - menuSize.width;
    }
  }

  // iOS is positioning these wrong when scrolled. I believe the bug is in
  // svg.getScreenCTM in Blockly.convertCoordinates, but prefer to make the
  // lower impact change here.
  if (Blockly.isIOS()) {
    xy.y -= scrollOffset.y;
  }

  Blockly.WidgetDiv.position(xy.x, xy.y, windowSize, scrollOffset);
};

/**
 * Factor out common words in statically defined options.
 * Create prefix and/or suffix labels.
 * @private
 */
Blockly.FieldDropdown.prototype.trimOptions_ = function() {
  this.prefixTitle = null;
  this.suffixTitle = null;
  var options = this.menuGenerator_;
  if (!goog.isArray(options) || options.length < 2) {
    return;
  }
  var strings = options.map(function(t) {
    return t[0];
  });
  var shortest = Blockly.shortestStringLength(strings);
  var prefixLength = Blockly.commonWordPrefix(strings, shortest);
  var suffixLength = Blockly.commonWordSuffix(strings, shortest);
  if (!prefixLength && !suffixLength) {
    return;
  }
  if (shortest <= prefixLength + suffixLength) {
    // One or more strings will entirely vanish if we proceed.  Abort.
    return;
  }
  if (prefixLength) {
    this.prefixTitle = strings[0].substring(0, prefixLength - 1);
  }
  if (suffixLength) {
    this.suffixTitle = strings[0].substr(1 - suffixLength);
  }
  // Remove the prefix and suffix from the options.
  var newOptions = [];
  for (var x = 0; x < options.length; x++) {
    var text = options[x][0];
    var value = options[x][1];
    text = text.substring(prefixLength, text.length - suffixLength);
    newOptions[x] = [text, value];
  }
  this.menuGenerator_ = newOptions;
};

/**
 * Return a list of the options for this dropdown.
 * @return {!Array.<!Array.<string>>} Array of option tuples:
 *     (human-readable text, language-neutral name).
 * @private
 */
Blockly.FieldDropdown.prototype.getOptions = function() {
  if (goog.isFunction(this.menuGenerator_)) {
    return this.menuGenerator_.call(this);
  }
  return /** @type {!Array.<!Array.<string>>} */ (this.menuGenerator_);
};

/**
 * Get the language-neutral value from this dropdown menu.
 * @return {string} Current text.
 */
Blockly.FieldDropdown.prototype.getValue = function() {
  return this.value_;
};

/**
 * Set the language-neutral value for this dropdown menu.
 * @param {string} newValue New value to set.
 */
Blockly.FieldDropdown.prototype.setValue = function(newValue) {
  if (this.alwaysCallChangeHandler_ && this.changeHandler_) {
    var override = this.changeHandler_(newValue);
    if (override !== undefined) {
      newValue = override;
    }
  }
  this.value_ = newValue;
  // Look up and display the human-readable text.
  var options = this.getOptions();
  for (var x = 0; x < options.length; x++) {
    // Options are tuples of human-readable text and language-neutral values.
    if (options[x][1] == newValue) {
      this.setText(options[x][0]);
      return;
    }
  }
  // Value not found.  Add it, maybe it will become valid once set
  // (like variable names).
  this.setText(newValue);
};

Blockly.FieldDropdown.prototype.setToFirstValue_ = function() {
  this.setValue(this.getOptions()[0][1]);
};

/**
 * Sets dropdown options to a set of numbers defined by the configString.
 * @param configString Option values to show. If the value is present in the
 *   block definition, use the corresponding option. Otherwise add a new option
 *   with the same value and display option.
 */
Blockly.FieldDropdown.prototype.setConfig = function(configString) {
  this.config = configString; // Store for later block -> XML copying

  var options = Blockly.printerRangeToNumbers(configString);
  if (options.length === 0) {
    options = (configString || '').split(',');
    options = goog.array.map(options, function(s) {
      return s.trim();
    });
    if (options.length === 0) {
      return;
    }
  }

  var existingOptions = {};
  goog.array.forEach(this.getOptions(), function(entry) {
    existingOptions[entry[1]] = entry[0];
  });

  this.menuGenerator_ = goog.array.map(options, function(option) {
    var existing = existingOptions[option];
    if (existing) {
      return [existing.toString(), option.toString()];
    }
    return [option.toString(), option.toString()];
  });

  this.setToFirstValue_();
};

/**
 * Set the text in this field.  Trigger a rerender of the source block.
 * @param {?string} text New text.
 */
Blockly.FieldDropdown.prototype.setText = function(text) {
  if (this.sourceBlock_) {
    // Update arrow's colour.
    this.arrow_.style.fill = this.sourceBlock_.getHexColour();
  }
  if (text === null) {
    // No change if null.
    return;
  }
  this.text_ = text;
  // Empty the text element.
  goog.dom.removeChildren(/** @type {!Element} */ (this.textElement_));
  // Replace whitespace with non-breaking spaces so the text doesn't collapse.
  text = text.replace(/\s/g, Blockly.Field.NBSP);
  if (!text) {
    // Prevent the field from disappearing if empty.
    text = Blockly.Field.NBSP;
  }
  var textNode = document.createTextNode(text);
  this.textElement_.appendChild(textNode);

  // Insert dropdown arrow.
  if (Blockly.RTL) {
    this.textElement_.insertBefore(this.arrow_, this.textElement_.firstChild);
  } else {
    this.textElement_.appendChild(this.arrow_);
  }

  // Cached width is obsolete.  Clear it.
  this.size_.width = 0;

  if (this.sourceBlock_ && this.sourceBlock_.rendered) {
    this.sourceBlock_.render();
    this.sourceBlock_.bumpNeighbours();
    this.sourceBlock_.blockSpace.fireChangeEvent();
  }
};

/**
 * Close the dropdown menu if this input is being deleted.
 */
Blockly.FieldDropdown.prototype.dispose = function() {
  Blockly.WidgetDiv.hideIfOwner(this);
  Blockly.FieldDropdown.superClass_.dispose.call(this);
};
