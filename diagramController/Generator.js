
DC.Generator = class {
   static clickHandler(event) {
      event.preventDefault();

      // check if disabled
      if (DC.Generator.isDisabled()) {
         return;
      }
      eval($(event.target.closest('[action]')).attr('action'));
      event.stopPropagation();
   }

   static draw() {
      if (DC.Generator.isDisabled()) {
         return;
      }

      // clear table
      const $generation_table = $('#generation-table');
      $generation_table.children().remove();

      // add a row for each strategy in Cayley diagram
      const num_strategies = Cayley_diagram.strategies.length;
      Cayley_diagram.strategies.forEach( (strategy, inx) =>
         $generation_table.append($(eval(Template.HTML('generation-template')))) );

      MathJax.Hub.Queue(['Typeset', MathJax.Hub, 'generation-table']);
   }

   static showGeneratorMenu(event, strategy_index) {
      DC.clearMenus();
      const $generator_menu = DC.Generator.getGenericMenu();

      // show only elements not generated by previously applied strategies
      const eligible = ( (strategy_index == 0) ?
                         new BitSet(Group.order, [0]) :
                         Cayley_diagram.strategies[strategy_index-1].bitset.clone() )
         .complement().toArray();

      $generator_menu.prepend(
         ...eligible.map( (generator) =>
            $(eval(Template.HTML('generator-menu-item-template')))
               .html(mathml2html(group.representation[generator])) )
      );

      $('#generation-table').append($generator_menu);
      Menu.setMenuLocations(event, $generator_menu);
   }

   static showAxisMenu(event, strategy_index) {
      DC.clearMenus();

      // previously generated subgroup must have > 2 cosets in this subgroup
      //   in order to show it in a curved (circular or rotated) layout
      const curvable =
         (Cayley_diagram.strategies[strategy_index].bitset.popcount()
            /  ((strategy_index == 0) ? 1 : Cayley_diagram.strategies[strategy_index - 1].bitset.popcount()))
      > 2;

      const $layout_menu = DC.Generator.getGenericMenu()
                             .prepend($(eval(Template.HTML('axis-menu-template'))));

      $('#generation-table').append($layout_menu);
      Menu.setMenuLocations(event, $layout_menu);
   }

   static showOrderMenu(event, strategy_index) {
      DC.clearMenus();
      const $order_menu = DC.Generator.getGenericMenu();

      const num_strategies = Cayley_diagram.strategies.length;
      $order_menu.prepend(
         ...Array.from({length: Cayley_diagram.strategies.length},
                       (_,order) => $(eval(Template.HTML('order-menu-item-template')))));

      $('#generation-table').append($order_menu);
      Menu.setMenuLocations(event, $order_menu);
   }

   static getGenericMenu() {
      const $menu = $(eval(Template.HTML('generation-menu-template')));

      const $organize_by_menu = $menu.find('#generation-organize-menu');

      // for each non-trivial subgroup
      Group.subgroups
           .forEach( (subgroup, inx) => {
              if (subgroup.order != 1 && subgroup.order != Group.order) {
                 $organize_by_menu.append($(eval(Template.HTML('organize-menu-item-template'))));
              }
           } )

      return $menu;
   }

   static organizeBy(subgroup_index) {
      // get subgroup generators
      const subgroup_generators = Group.subgroups[subgroup_index].generators.toArray();

      // add subgroup generator(s) to start of strategies
      for (let g = 0; g < subgroup_generators.length; g++) {
         DC.Generator.updateGenerator(g, subgroup_generators[g]);
      }
   }

   /*
    * change generator as spec'd
    *
    * delete newly redundant later generators
    * add generator to make strategy set generate entire group
    */
   static updateGenerator(strategy_index, generator) {
      DC.Generator.updateStrategies( (strategies) => {
         strategies[strategy_index][0] = generator;

         const generators_used = new BitSet(Group.order);
         let elements_generated = new BitSet(Group.order, [0]);
         Cayley_diagram.strategies.forEach( (strategy, inx) => {
            if (inx < strategy_index) {
               generators_used.set(strategy.generator);
               elements_generated = strategy.bitset;
            } else if (elements_generated.isSet(strategy.generator)) {
               // mark strategy for deletion by setting generator to 'undefined'
               strategy.generator = undefined;
               // collapse nesting values
               if (strategy.generator === undefined) {
                  for (let i = inx; i < strategies.length; i++) {
                     if (strategies[i][3] > strategy[3]) {
                        strategies[i][3] -= 1;
                     }
                  }
               }
            } else {
               generators_used.set(strategies[inx][0]);
               elements_generated = Group.closure(generators_used);

               // check whether we can still use a curved display
               if (strategies[inx][1] != 0 && Group.closure(generators_used).popcount()/elements_generated.popcount() < 3) {
                  strategies[inx][1] = 0;
               }
            }
         } )

         // delete marked strategies
         Cayley_diagram.strategies = Cayley_diagram.strategies.filter( (strategy) => strategy.generator !== undefined );

         // add elements to generate entire group; append to nesting
         if (elements_generated.popcount() != Group.order) {
            // look for new element
            const new_generator = elements_generated
               .complement()
               .toArray()
               .find( (el) => Group.closure(generators_used.clone().set(el)).popcount() == Group.order );
            // among linear layouts, try to find a direction that hasn't been used yet
            const new_direction =
               strategies.reduce( (used_directions, [_, layout, direction, __]) => {
                  if (layout == 0) {
                     used_directions[direction] = true;
                  }
                  return used_directions;
               }, new Array(3).fill(false) )
                         .findIndex( (used) => !used );
            strategies.push([new_generator, 0, (new_direction == -1) ? 0 : new_direction, strategies.length]);
         }

         return strategies;
      } )
   }

   static updateAxes(strategy_index, layout, direction) {
      DC.Generator.updateStrategies( (strategies) => {
         strategies[strategy_index][1] = layout;
         strategies[strategy_index][2] = direction;
         return strategies;
      } );
   }

   static updateOrder(strategy_index, order) {
      DC.Generator.updateStrategies( (strategies) => {
         const other_strategy = strategies.findIndex( (strategy) => strategy[3] == order );
         strategies[other_strategy][3] = strategies[strategy_index][3];
         strategies[strategy_index][3] = order;
         return strategies;
      } );
   }

   static updateStrategies(strategyUpdater) {
      const strategies = strategyUpdater(Cayley_diagram.getStrategies());
      Cayley_diagram.setStrategies(strategies);
      Cayley_diagram.removeLines();
      DC.Arrow.getAllArrows().forEach( (arrow) => Cayley_diagram.addLines(arrow) );
      Cayley_diagram.setLineColors();
      Graphic_context.showGraphic(Cayley_diagram);
      DC.Generator.draw();
   }

   static enable() {
      $('#generation-fog').hide();
   }

   static disable() {
      const $generation_fog = $('#generation-fog');
      $generation_fog.css('height', $generation_fog.parent().css('height'));
      $generation_fog.css('width', $generation_fog.parent().css('width'));
      $('#generation-fog').show();
   }

   static isDisabled() {
      return $('#generation-fog').css('display') != 'none';  // fog is hidden
   }
}

// layout (linear/circular/rotated), direction (X/Y/Z)
DC.Generator.axis_label = [
   ['Linear in x', 'Linear in y', 'Linear in z'],
   ['Circular in y,z', 'Circular in x,z', 'Circular in x,y'],
   ['Rotated in y,z', 'Rotated in x,z', 'Rotated in x,y'],
];

DC.Generator.axis_image = [
   ['axis-x.png', 'axis-y.png', 'axis-z.png'],
   ['axis-yz.png', 'axis-xz.png', 'axis-xy.png'],
   ['axis-ryz.png', 'axis-rxz.png', 'axis-rxy.png']
];

// wording for nesting order
DC.Generator.orders = [
   [],
   ['N/A'],
   ['inside', 'outside'],
   ['innermost', 'middle', 'outermost'],
   ['innermost', 'third innermost', 'second outermost', 'outermost'],
   ['innermost', 'third innermost', 'middle', 'second outermost', 'outermost']
];
