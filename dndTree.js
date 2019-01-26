function close_modal() {
    $(document).foundation('reveal', 'close');
}

var root;
var tree_root;
var create_node_modal_active = false;
var rename_node_modal_active = false;
var create_node_parent = null;
var node_to_rename = null;

function generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
};

function create_node() {
    if (create_node_parent && create_node_modal_active) {
        if (create_node_parent._children != null) {
            create_node_parent.children = create_node_parent._children;
            create_node_parent._children = null;
        }
        if (create_node_parent.children == null) {
            create_node_parent.children = [];
        }
        id = generateUUID();
        name = $('#CreateNodeName').val();
        new_node = {
            'name': name,
            'id': id,
            'depth': create_node_parent.depth + 1,
            'children': [],
            '_children': null
        };
        console.log('Create Node name: ' + name);
        create_node_parent.children.push(new_node);
        create_node_modal_active = false;
        $('#CreateNodeName').val('');
    }
    close_modal();
    outer_update(create_node_parent);
}

function rename_node() {
    if (node_to_rename && rename_node_modal_active) {
        name = $('#RenameNodeName').val();
        console.log('New Node name: ' + name);
        node_to_rename.name = name;
        rename_node_modal_active = false;

    }
    close_modal();
    outer_update(node_to_rename);
}

outer_update = null;

function draw_tree(error, treeData) {
    root = treeData
    // Calculate total nodes, max label length
    var totalNodes = 0;
    var maxLabelLength = 0;
    // variables for drag/drop
    var selectedNode = null;
    var draggingNode = null;
    // panning variables
    var panSpeed = 200;
    var panBoundary = 20; // Within 20px from edges will pan when dragging.
    // Misc. variables
    var i = 0;
    var duration = 750;
    var root;

    // size of the diagram
    var viewerWidth = $(document).width();
    var viewerHeight = $(document).height();

    var tree = d3.layout.tree()
        .size([viewerHeight, viewerWidth]);

    // define a d3 diagonal projection for use by the node paths later on.
    var diagonal = d3.svg.diagonal()
        .projection(function (d) {
            return [d.y, d.x];
        });

    var menu = [
        {
            title: 'Rename node',
            action: function (elm, d, i) {
                console.log('Rename node');
                $("#RenameNodeName").val(d.name);
                rename_node_modal_active = true;
                node_to_rename = d
                $("#RenameNodeName").focus();
                $('#RenameNodeModal').foundation('reveal', 'open');
            }
        },
        {
            title: 'Delete node',
            action: function (elm, d, i) {
                console.log('Delete node');
                delete_node(d);
            }
        },
        {
            title: 'Create child node',
            action: function (elm, d, i) {
                console.log('Create child node');
                create_node_parent = d;
                create_node_modal_active = true;
                $('#CreateNodeModal').foundation('reveal', 'open');
                $('#CreateNodeName').focus();
            }
        }
    ]


    // A recursive helper function for performing some setup by walking through all nodes

    function visit(parent, visitFn, childrenFn) {
        if (!parent) return;

        visitFn(parent);

        var children = childrenFn(parent);
        if (children) {
            var count = children.length;
            for (var i = 0; i < count; i++) {
                visit(children[i], visitFn, childrenFn);
            }
        }
    }

    // Call visit function to establish maxLabelLength
    visit(treeData, function (d) {
        totalNodes++;
        maxLabelLength = Math.max(d.name.length, maxLabelLength);

    }, function (d) {
        return d.children && d.children.length > 0 ? d.children : null;
    });

    function delete_node(node) {
        visit(treeData, function (d) {
            if (d.children) {
                for (var child of d.children) {
                    if (child == node) {
                        d.children = _.without(d.children, child);
                        update(root);
                        break;
                    }
                }
            }
        },
            function (d) {
                return d.children && d.children.length > 0 ? d.children : null;
            });
    }


    // sort the tree according to the node names

    function sortTree() {
        tree.sort(function (a, b) {
            // return b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1;
            return b.order < a.order ? 1 : -1;
        });
    }
    // Sort the tree initially incase the JSON isn't in a sorted order.
    sortTree();

    // TODO: Pan function, can be better implemented.

    function pan(domNode, direction) {
        var speed = panSpeed;
        if (panTimer) {
            clearTimeout(panTimer);
            translateCoords = d3.transform(svgGroup.attr("transform"));
            if (direction == 'left' || direction == 'right') {
                translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
                translateY = translateCoords.translate[1];
            } else if (direction == 'up' || direction == 'down') {
                translateX = translateCoords.translate[0];
                translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
            }
            scaleX = translateCoords.scale[0];
            scaleY = translateCoords.scale[1];
            scale = zoomListener.scale();
            svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + scale + ")");
            d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
            zoomListener.scale(zoomListener.scale());
            zoomListener.translate([translateX, translateY]);
            panTimer = setTimeout(function () {
                pan(domNode, speed, direction);
            }, 50);
        }
    }

    // Define the zoom function for the zoomable tree
    function zoom() {
        svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }

    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);

    // define the baseSvg, attaching a class for styling and the zoomListener
    var baseSvg = d3.select("#tree-container").append("svg")
        .attr("width", viewerWidth)
        .attr("height", viewerHeight);

    baseSvg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "white")

    baseSvg.call(zoomListener);

    // Select2 stuff (search feature)
    select2Data = [];
    select2DataCollectName(treeData);
    select2DataObject = [];
    select2Data.sort(function (a, b) {
        if (a > b) return 1; // sort
        if (a < b) return -1;
        return 0;
    })
        .filter(function (item, i, ar) {
            return ar.indexOf(item) === i;
        }) // remove duplicate items
        .filter(function (item, i, ar) {
            select2DataObject.push({
                "id": i,
                "text": item
            });
        });
    select2Data.sort(function (a, b) {
        if (a > b) return 1; // sort
        if (a < b) return -1;
        return 0;
    })
        .filter(function (item, i, ar) {
            return ar.indexOf(item) === i;
        }) // remove duplicate items
        .filter(function (item, i, ar) {
            select2DataObject.push({
                "id": i,
                "text": item
            });
        });
    $("#searchName").select2({
        data: select2DataObject,
        containerCssClass: "search"
    });

    d3.select(self.frameElement).style("height", "800px");

    // Helper functions for collapsing and expanding nodes.

    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }

    function clearAll(d) {
        d.class = "";
        if (d.children)
            d.children.forEach(clearAll);
        else if (d._children)
            d._children.forEach(clearAll);
    }

    function collapseAllNotFound(d) {
        if (d.children) {
            if (d.class !== "found") {
                d._children = d.children;
                d._children.forEach(collapseAllNotFound);
                d.children = null;
            } else
                d.children.forEach(collapseAllNotFound);
        }
    }

    function expand(d) {
        if (d._children) {
            d.children = d._children;
            d.children.forEach(expand);
            d._children = null;
        }
    }

    function expandAll(d) {
        if (d._children) {
            d.children = d._children;
            d.children.forEach(expandAll);
            d._children = null;
        } else if (d.children)
            d.children.forEach(expandAll);
    }

    // Toggle children on click.
    function toggle(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        clearAll(root);
        update(d);
        $("#searchName").select2("val", "");
    }

    //===============================================
    $("#searchName").on("select2-selecting", function (e) {
        clearAll(root);
        expandAll(root);
        update(root);

        searchField = "d.name";
        searchText = e.object.text;
        searchTree(root);
        root.children.forEach(collapseAllNotFound);
        update(root);
        centerNode(root);
    })

    //===============================================
    function select2DataCollectName(d) {
        if (d.children)
            d.children.forEach(select2DataCollectName);
        else if (d._children)
            d._children.forEach(select2DataCollectName);
        select2Data.push(d.name);
    }

    //===============================================
    function searchTree(d) {
        if (d.children)
            d.children.forEach(searchTree);
        else if (d._children)
            d._children.forEach(searchTree);
        var searchFieldValue = eval(searchField);
        if (searchFieldValue && searchFieldValue.match(searchText)) {
            // Walk parent chain
            var ancestors = [];
            var parent = d;
            while (typeof (parent) !== "undefined") {
                ancestors.push(parent);
                //console.log(parent);
                parent.class = "found";
                parent = parent.parent;
            }
            //console.log(ancestors);
        }
    }

    var overCircle = function (d) {
        selectedNode = d;
        updateTempConnector();
    };
    var outCircle = function (d) {
        selectedNode = null;
        updateTempConnector();
    };

    // color a node properly
    function colorNode(d) {
        result = "#fff";
        if (d.synthetic == true) {
            result = (d._children || d.children) ? "darkgray" : "lightgray";
        }
        else {
            if (d.type == "USDA") {
                result = (d._children || d.children) ? "orangered" : "orange";
            } else if (d.type == "Produce") {
                result = (d._children || d.children) ? "yellowgreen" : "yellow";
            } else if (d.type == "RecipeIngredient") {
                result = (d._children || d.children) ? "skyblue" : "royalblue";
            } else {
                result = "lightsteelblue"
            }
        }
        return result;
    }

    function centerNode(source) {
        scale = zoomListener.scale();
        x = -source.y0;
        y = -source.x0;
        x = x * scale + viewerWidth / 2;
        y = y * scale + viewerHeight / 2;
        d3.select('g').transition()
            .duration(duration)
            .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
        zoomListener.scale(scale);
        zoomListener.translate([x, y]);
    }

    // Toggle children function

    function toggleChildren(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else if (d._children) {
            d.children = d._children;
            d._children = null;
        }
        return d;
    }

    // Toggle children on click.

    function click(d) {
        if (d3.event.defaultPrevented) return; // click suppressed
        d = toggleChildren(d);
        update(d);
        centerNode(d);
    }

    function update(source) {
        // Compute the new height, function counts total children of root node and sets tree height accordingly.
        // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
        // This makes the layout more consistent.
        var levelWidth = [1];
        var childCount = function (level, n) {

            if (n.children && n.children.length > 0) {
                if (levelWidth.length <= level + 1) levelWidth.push(0);

                levelWidth[level + 1] += n.children.length;
                n.children.forEach(function (d) {
                    childCount(level + 1, d);
                });
            }
        };
        childCount(0, root);
        var newHeight = d3.max(levelWidth) * 25; // 25 pixels per line  
        tree = tree.size([newHeight, viewerWidth]);

        // Compute the new tree layout.
        var nodes = tree.nodes(root).reverse(),
            links = tree.links(nodes);

        // Set widths between levels based on maxLabelLength.
        nodes.forEach(function (d) {
            //d.y = (d.depth * (maxLabelLength * 10)); //maxLabelLength * 10px
            // alternatively to keep a fixed scale one can set a fixed depth per level
            // Normalize for fixed-depth by commenting out below line
            d.y = (d.depth * 200); //500px per level.
        });

        // Update the nodes…
        node = svgGroup.selectAll("g.node")
            .data(nodes, function (d) {
                return d.id || (d.id = ++i);
            });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .on('click', click);

        nodeEnter.append("circle")
            .attr('class', 'nodeCircle')
            .attr("r", 0)
            .style("fill", colorNode);

        nodeEnter.append("text")
            .attr("x", function (d) {
                return d.children || d._children ? -10 : 10;
            })
            .attr("dy", ".35em")
            .attr('class', 'nodeText')
            .attr("text-anchor", function (d) {
                return d.children || d._children ? "end" : "start";
            })
            .text(function (d) {
                return d.name;
            })
            .style("fill-opacity", 0);

        // Update the text to reflect whether node has children or not.
        node.select('text')
            .attr("x", function (d) {
                return d.children || d._children ? -10 : 10;
            })
            .attr("text-anchor", function (d) {
                return d.children || d._children ? "end" : "start";
            })
            .text(function (d) {
                return d.name;
            });

        // Change the circle fill depending on whether it has children and is collapsed
        node.select("circle.nodeCircle")
            .attr("r", 4.5)
            .style("fill", colorNode);

        // Add a context menu
        node.on('contextmenu', d3.contextMenu(menu));


        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + d.y + "," + d.x + ")";
            });

        // Fade the text in
        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        nodeUpdate.select("circle")
            .attr("r", 4.5)
            .style("fill", function (d) {
                if (d.class === "found") {
                    return "#ff4136"; //red
                } else if (d._children) {
                    return "lightsteelblue";
                } else {
                    return "#fff";
                }
            })
            .style("stroke", function (d) {
                if (d.class === "found") {
                    return "#ff4136"; //red
                }
            });

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .remove();

        nodeExit.select("circle")
            .attr("r", 0);

        nodeExit.select("text")
            .style("fill-opacity", 0);

        // Update the links…
        var link = svgGroup.selectAll("path.link")
            .data(links, function (d) {
                return d.target.id;
            });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", function (d) {
                var o = {
                    x: source.x0,
                    y: source.y0
                };
                return diagonal({
                    source: o,
                    target: o
                });
            });


        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", diagonal)
            .style("stroke", function (d) {
                if (d.target.class === "found") {
                    return "#ff4136";
                }
            });

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function (d) {
                var o = {
                    x: source.x,
                    y: source.y
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function (d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    outer_update = update;

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    var svgGroup = baseSvg.append("g");

    // Define the root
    root = treeData;
    root.x0 = viewerHeight / 2;
    root.y0 = 0;

    // Layout the tree initially and center on the root node.
    update(root);
    centerNode(root);
    tree_root = root;
}