var PropertyMatch = require('./tree').PropertyMatch;
var PropertyAbsent = require('./tree').PropertyAbsent;
var CustomMatch = require('./tree').CustomMatch;

function Match(entity) {
  this.entity = entity;
  this.bemhtml = this.entity.bemhtml;
  this.templates = [];

  // applyNext index
  this.index = 0;

  this.count = 0;
}
exports.Match = Match;

Match.prototype.push = function push(template) {
  this.templates.push(new MatchTemplate(this, template));
  this.count++;
};

Match.prototype.exec = function exec(context) {
  // Fast case - no templates
  if (this.count === this.index)
    return undefined;

  for (var i = this.index; i < this.count; i++) {
    var template = this.templates[i];
    for (var j = template.predicates.length - 1; j >= 0; j--) {
      var pred = template.predicates[j];
      if (!pred.exec(context))
        break;
    }

    // All predicates matched!
    if (j === -1)
      break;
  }

  var oldIndex = this.index;
  var oldMatch = this.bemhtml.match;
  this.index = i + 1;
  this.bemhtml.match = this;

  var out;
  if (typeof template.body === 'function')
    out = template.body.call(context);
  else
    out = template.body;

  this.index = oldIndex;
  this.bemhtml.match = oldMatch;

  return out;
};

function MatchTemplate(mode, template) {
  this.mode = mode;
  this.predicates = new Array(template.predicates.length);
  this.body = template.body;

  for (var i = 0; i < this.predicates.length; i++) {
    var pred = template.predicates[i];
    if (pred instanceof PropertyMatch) {
      if (Array.isArray(pred.key))
        this.predicates[i] = new MatchNested(this, pred);
      else
        this.predicates[i] = new MatchProperty(this, pred);
    } else if (pred instanceof PropertyAbsent) {
      this.predicates[i] = new MatchAbsent(this, pred);
    } else if (pred instanceof CustomMatch) {
      this.predicates[i] = new MatchCustom(this, pred);
    } else {
      throw new Error('Unknown predicate type: ' + pred.constructor.name);
    }
  }
}
exports.MatchTemplate = MatchTemplate;

function MatchProperty(template, pred) {
  this.template = template;
  this.key = pred.key;
  this.value = pred.value;
}

MatchProperty.prototype.exec = function exec(context) {
  return context[this.key] === this.value;
};

function MatchNested(template, pred) {
  this.template = template;
  this.keys = pred.key;
  this.value = pred.value;
}

MatchNested.prototype.exec = function exec(context) {
  var val = context;
  for (var i = 0; i < this.keys.length - 1; i++) {
    val = val[this.keys[i]];
    if (!val)
      return false;
  }

  return val[this.keys[i]] === this.value;
};

function MatchAbsent(template, pred) {
  this.template = template;
  this.key = pred.key;
}

MatchAbsent.prototype.exec = function exec(context) {
  return !context[this.key];
};

function MatchCustom(template, pred) {
  this.template = template;
  this.body = pred.body;
}

MatchCustom.prototype.exec = function exec(context) {
  return this.body.call(context);
};