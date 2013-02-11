$(document).ready(function() {

  var Minesweeper = {
    active: true,
    correct_flags: 0,
    flags: 0,
    max_flags: 0,
    alertStatus: function() {
      if ((this.flags == this.max_flags) && (this.max_flags == this.correct_flags)) {
        alert("You win!");
      }
      else {
        alert("You lose");
      }
    }
  };

  Minesweeper.GridCell = Backbone.Model.extend({
    defaults: {
      force_display: false,
      revealed: false,
      has_mine: false,
      flagged: false,
      x: 0, y: 0,
      adjacent_mines: 0,
      adjacent_cells: new Array()
    },

    toggleFlag: function() {
      if (this.get('has_mine')) {
        if (this.get('flagged')) {
          Minesweeper.correct_flags--;
          Minesweeper.flags--;
        }
        else {
          Minesweeper.correct_flags++;
          Minesweeper.flags++;
        }
      }
      else if (this.get('flagged')) {
        Minesweeper.flags--;
      }
      else {
        Minesweeper.flags++;
      }
      this.set({'flagged': !this.get('flagged')});
    },

    connectWith: function(cell) {
      var this_adj_cells = this.get('adjacent_cells');
      var adj_adj_cells = cell.get('adjacent_cells');
      this_adj_cells.push(cell);
      adj_adj_cells.push(this);
      this.set({'adjacent_cells': this_adj_cells});
      cell.set({'adjacent_cells': adj_adj_cells});
    },

    addMine: function() {
      this.set({'has_mine': true});
      _(this.get('adjacent_cells')).each(function(cell){
        cell.set({'adjacent_mines': cell.get('adjacent_mines')+1});
      });
    },

    reveal: function() {
      if (!this.get('revealed')) {
        this.set({'revealed': true});
        if (this.get('has_mine')) {
          Minesweeper.active = false;
          Minesweeper.alertStatus();
        }
        else if (this.get('adjacent_mines') == 0) {
          _(this.get('adjacent_cells')).each(function(cell) {
            cell.reveal();
          });
        }
      }
    }

  });


  Minesweeper.GridCellView = Backbone.View.extend({
    tagName: 'div',
    className: 'grid_cell',
    attributes: {
      'oncontextmenu': 'return false;'
    },

    initialize: function(options) {
      this.model.on('change', this.render, this);
      _.bindAll(this, 'render', 'clickCell');
    },

    events: {
      'mousedown': 'clickCell'
    },

    render: function() {
      var x = this.model.get('x');
      var y = this.model.get('y');
      if (this.model.get('revealed') || (this.model.get('force_display'))) {
        if (this.model.get('has_mine')) {
          $(this.el).html('<p>M</p>');
        }
        else {
          if (this.model.get('adjacent_mines') > 0) {
            $(this.el).html('<p>'+this.model.get('adjacent_mines')+'</p>');
          }
          $(this.el).removeClass('grid_cell');
          $(this.el).addClass('grid_cell_revealed');
        }
      }
      else if (this.model.get('flagged')) {
        $(this.el).html('<p>X</p>');
      }
      else {
        $(this.el).html('');
      }
      $(this.el).css('left', x*50);
      $(this.el).css('bottom', y*58 + x*29);
      return this;
    },

    clickCell: function(e) {
      e.preventDefault();
      if (Minesweeper.active) {
        switch (e.which) {
          case 1:
            this.model.reveal();
            break;
          case 3:
            this.model.toggleFlag();
            break;
        }
      }
      return this;
    }

  });


  Minesweeper.Grid = Backbone.Collection.extend({
    model: Minesweeper.GridCell,

    initialize: function(models, options) {
      this.game_active = true;
      var gridCells = new Array();
      for (var i = 0; i < options.rows; i++) {
        gridCells[i] = new Array();
        for (var j = 0; j < options.columns; j++) {
          var adj_cells = new Array();
          gridCells[i][j] = new Minesweeper.GridCell({
            x: i,
            y: j,
            adjacent_cells: adj_cells
          });
          this.addConnections(gridCells, i, j, options.columns);
          this.add(gridCells[i][j]);
        }
      }
      this.depositMines(gridCells, options.rows, options.columns, options.mines);
      return this;
    },

    addConnections: function(gridCells, i, j, columns) {
      if (i > 0) {
        gridCells[i][j].connectWith(gridCells[i-1][j]);
        if (j > 0) {
          gridCells[i][j].connectWith(gridCells[i-1][j-1]);
        }
        if (j < columns - 1) {
          gridCells[i][j].connectWith(gridCells[i-1][j+1]);
        }
      }
      if (j > 0) {
        gridCells[i][j].connectWith(gridCells[i][j-1]);
      }
    },

    depositMines: function(cells, rows, columns, num_mines) {
      var pos_x = Math.floor(Math.random()*rows);
      var pos_y = Math.floor(Math.random()*columns);
      if (num_mines > rows*columns) { num_mines = rows*columns; }
      for (i = 0; i < num_mines; i++) {
        while (cells[pos_x][pos_y].get('has_mine')) {
          var pos_x = Math.floor(Math.random()*rows);
          var pos_y = Math.floor(Math.random()*columns);
        }
        cells[pos_x][pos_y].addMine();
      }
    },

    revealAll: function() {
      _(this.models).each(function(cell) {
        cell.reveal();
      });
    }

  });


  Minesweeper.GridView = Backbone.View.extend({
    el: $('body div#minesweeper'),

    events: { 
      'click a.new_game':  'newGame',
      'click a.validate': 'validate',
      'click a.cheat': 'cheat'
    },  

    initialize: function(options) {
      _.bindAll(this, 'render', 'unrender', 'addCell', 'newGame', 'validate', 'cheat');
      this.rows = options.rows;
      this.columns = options.columns;
      this.mines = options.mines;
      Minesweeper.max_flags = options.mines;
      this.collection = new Minesweeper.Grid(null, {rows:this.rows, columns:this.columns, mines:this.mines});
      this.collection.bind('add', this.addCell);
      this.render();
    },

    render: function() {
      var self = this;
      $(this.el).append('<a class="new_game" href="#">New Game</a> | <a class="validate" href="#">Validate</a> | <a class="cheat" href="#">Cheat</a><div id="grid_container"><div class="isometric" id="grid"></div></div>');
      $('#grid_container').css('top', this.rows*29);
      $('#grid_container').css('left', 25);
      _(this.collection.models).each(function(cell) {
        self.addCell(cell);
      }, this);
    },

    unrender: function() {
      $(this.el).html('');
    },

    addCell: function(cell) {
      var gridCellView = new Minesweeper.GridCellView({model: cell});
      $('div#grid', this.el).append(gridCellView.render().el);
    },

    newGame: function() {
      this.unrender();
      this.collection = new Minesweeper.Grid(null, {rows:this.rows, columns:this.columns, mines:this.mines});
      Minesweeper.active = true;
      Minesweeper.flags = 0;
      Minesweeper.correct_flags = 0;
      this.render();
    },

    validate: function() {
      Minesweeper.active = false;
      Minesweeper.alertStatus();
    },

    cheat: function() {
      _.each(_(this.collection.models).filter(function(cell) {
        return cell.get('has_mine') == true;
      }), function(cell) {
        cell.set({'force_display': true});
      });
    }

  });


  Minesweeper.gridView = new Minesweeper.GridView({'rows':8, 'columns':8, 'mines':10});
});
