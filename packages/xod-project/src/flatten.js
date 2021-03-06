import * as R from 'ramda';
import { Maybe, Either } from 'ramda-fantasy';

import {
  explode,
  explodeMaybe,
  catMaybies,
  fail,
  failOnNothing,
  prependTraceToError,
  foldMaybe,
  isAmong,
} from 'xod-func-tools';

import * as CONST from './constants';
import * as Project from './project';
import * as Patch from './patch';
import * as Pin from './pin';
import * as Node from './node';
import * as Link from './link';
import { def } from './types';
import { isGenericType } from './utils';
import * as PatchPathUtils from './patchPathUtils';
import { getPinKeyForTerminalDirection } from './builtinTerminalPatches';

// =============================================================================
//
// Wrappers for project entities
//
// =============================================================================

/* eslint-disable new-cap */
function baseChain(f) {
  return f(this.value);
}
function baseGet() {
  return this.value;
}

function NodeWrapper(x) {
  this.value = x;
}
function LinkWrapper(x) {
  this.value = x;
}

const Wr = {
  Node: x => new NodeWrapper(x),
  Link: x => new LinkWrapper(x),
  get: wrapper => wrapper.get(),
  isNode: x => x.isNode,
  isLink: x => x.isLink,
};

NodeWrapper.prototype.isNode = true;
NodeWrapper.prototype.isLink = false;
NodeWrapper.prototype.map = function mapNode(f) {
  return Wr.Node(f(this.value));
};
NodeWrapper.prototype.chain = baseChain;
NodeWrapper.prototype.get = baseGet;

LinkWrapper.prototype.isNode = false;
LinkWrapper.prototype.isLink = true;
LinkWrapper.prototype.map = function mapLink(f) {
  return Wr.Link(f(this.value));
};
LinkWrapper.prototype.chain = baseChain;
LinkWrapper.prototype.get = baseGet;

/* eslint-enable new-cap */

// =============================================================================
//
// Utils
//
// =============================================================================

// :: Node -> Boolean
const isInternalTerminalNode = R.compose(
  PatchPathUtils.isInternalTerminalPatchPath,
  Node.getNodeType
);

// :: Node -> Boolean
const isGenericInternalTerminal = R.compose(
  PatchPathUtils.isInternalGenericPatchPath,
  Node.getNodeType
);

const terminalOriginalDirectionLens = R.lensProp('originalDirection');

const isLeafPatchWithImplsOrTerminal = def(
  'isLeafPatchWithImplsOrTerminal :: Patch -> Boolean',
  R.anyPass([
    Patch.isPatchNotImplementedInXod,
    Patch.isTerminalPatch,
    R.pipe(Patch.getPatchPath, R.equals(CONST.NOT_IMPLEMENTED_IN_XOD_PATH)),
  ])
);

const isLeafPatchWithoutImpls = def(
  'isLeafPatchWithoutImpls :: Patch -> Boolean',
  R.both(R.complement(Patch.hasImpl), Patch.isPatchNotImplementedInXod)
);

// :: [Path, Patch] -> [Path, Patch]
const extendTerminalPins = R.curry(([path, patch]) => {
  if (!Patch.isTerminalPatch(patch)) {
    return [path, patch];
  }

  const internalTerminalPath = PatchPathUtils.convertToInternalTerminalPath(
    path
  );
  return [
    internalTerminalPath,
    Patch.setPatchPath(internalTerminalPath, patch),
  ];
});

// :: Function extractLeafPatches -> String[] -> Project -> Node -> Either Error [Path, Patch, ...]
const extractLeafPatchRecursive = R.curry((recursiveFn, project, node) =>
  R.compose(
    path =>
      R.compose(
        R.chain(recursiveFn(project, path)),
        failOnNothing('PATCH_NOT_FOUND_BY_PATH', { patchPath: path }),
        Project.getPatchByPath(R.__, project)
      )(path),
    Node.getNodeType
  )(node)
);

// :: Function extractLeafPatches -> Project -> Patch -> [Path, Patch, ...]
const extractLeafPatchesFromNodes = R.curry((recursiveFn, project, patch) =>
  R.compose(
    R.chain(extractLeafPatchRecursive(recursiveFn, project)),
    Patch.listNodes
  )(patch)
);

export const extractLeafPatches = def(
  'extractLeafPatches :: Project -> PatchPath -> Patch -> [Either Error (Pair PatchPath Patch)]',
  (project, path, patch) =>
    R.cond([
      [
        isLeafPatchWithoutImpls,
        R.compose(R.of, () =>
          fail('IMPLEMENTATION_NOT_FOUND', { patchPath: path, trace: [path] })
        ),
      ],
      [
        R.either(isLeafPatchWithImplsOrTerminal, Patch.isAbstractPatch),
        R.compose(R.of, Either.of, leafPatch => [path, leafPatch]),
      ],
      [
        R.T,
        R.compose(
          R.map(prependTraceToError(path)),
          extractLeafPatchesFromNodes(extractLeafPatches, project)
        ),
      ],
    ])(patch)
);

// :: String -> Node
const getNodeById = R.curry((patch, node) =>
  R.compose(explode, Patch.getNodeById(R.__, patch))(node)
);

// :: String[] -> Node -> Boolean
const isLeafNode = R.curry((leafPatchPaths, node) =>
  R.compose(
    R.either(
      R.contains(R.__, leafPatchPaths),
      PatchPathUtils.isTerminalPatchPath
    ),
    Node.getNodeType
  )(node)
);

// :: String -> String -> String
const getPrefixedId = R.curry(
  (prefix, id) => (prefix ? `${prefix}~${id}` : id)
);

const getPinType = R.curry((patchTuples, nodes, idGetter, keyGetter, link) => {
  const pinKey = keyGetter(link);
  const node = R.compose(R.find(R.__, nodes), R.propEq('id'), idGetter)(link);

  const patch = R.compose(
    R.nth(1),
    R.find(R.__, patchTuples),
    R.propEq(0),
    Node.getNodeType
  )(node);

  return R.compose(
    Pin.getPinType,
    explodeMaybe(`Pin ${pinKey} should be in patch ${JSON.stringify(patch)}`),
    Patch.getVariadicPinByKey(node, pinKey)
  )(patch);
});

/**
 * Replace terminal node with casting node
 *
 * See {@link flatten} docs (2.3)
 *
 * @private
 * @function createCastNode
 * @param {Array<Array<Path, Patch>>} patchTuples
 * @param {Array<Node>} nodes
 * @param {Link} link
 * @returns {Maybe<Node>}
 */
// :: [[Path, Patch]] -> [Node] -> Link -> Maybe Node
const createCastNode = R.curry((patchTuples, nodes, link) =>
  R.compose(
    R.map(
      R.assoc(
        'id',
        [
          Link.getLinkOutputNodeId(link),
          '-to-',
          Link.getLinkInputNodeId(link),
          '-pin-',
          Link.getLinkInputPinKey(link),
        ].join('')
      )
    ),
    R.map(Node.createNode({ x: 0, y: 0 })),
    // Link -> Maybe String
    R.converge(
      R.ifElse(
        R.either(
          // don't create cast nodes between pins of the same type...
          R.equals,
          // ... and between generic pins
          R.pipe(R.pair, R.any(isGenericType))
        ),
        Maybe.Nothing,
        PatchPathUtils.getCastPatchPath
      ),
      [
        getPinType(
          patchTuples,
          nodes,
          Link.getLinkOutputNodeId,
          Link.getLinkOutputPinKey
        ),
        getPinType(
          patchTuples,
          nodes,
          Link.getLinkInputNodeId,
          Link.getLinkInputPinKey
        ),
      ]
    )
  )(link)
);

// :: [Pin] -> Maybe PinKey
const getFirstPinKey = R.compose(R.map(Pin.getPinKey), Maybe, R.head);

const FAKE_CAST_NODE_PINKEY_WILL_BE_CATCHED_ON_VALIDATION =
  'fakeCastNodePinKey';
// Returns input & output pin keys of a cast node.
// In case that there is no such patch or pins it fallbacks
// to invalid PinKey names and the error will be catches then
// on validation stage.
// :: Project -> Node -> [PinKey, PinKey]
const getCastNodePinKeys = R.curry((project, castNode) =>
  R.compose(
    foldMaybe(
      [
        FAKE_CAST_NODE_PINKEY_WILL_BE_CATCHED_ON_VALIDATION,
        FAKE_CAST_NODE_PINKEY_WILL_BE_CATCHED_ON_VALIDATION,
      ],
      R.identity
    ),
    R.chain(
      R.compose(
        R.sequence(Maybe.of),
        R.juxt([
          R.compose(getFirstPinKey, Patch.listInputPins),
          R.compose(getFirstPinKey, Patch.listOutputPins),
        ])
      )
    ),
    Project.getPatchByNode
  )(castNode, project)
);

/**
 * It replaces link with casting nodes and
 * new links, if needed. Otherwise it returns
 * the same link.
 *
 * See {@link flatten} docs (2.3)
 *
 * @private
 * @function splitLinkWithCastNode
 * @param {Project} project
 * @param {Array<Array<Path, Patch>>} patchTuples
 * @param {Array<Node>} nodes
 * @param {Link} link
 * @returns {Array<Node|Null, Array<Link>>}
 */
const splitLinkWithCastNode = R.curry((project, patchTuples, nodes, link) =>
  R.compose(
    foldMaybe(
      [null, [link]], // fallback
      castNode => {
        const origLinkId = Link.getLinkId(link);
        const fromNodeId = Link.getLinkOutputNodeId(link);
        const fromPinKey = Link.getLinkOutputPinKey(link);
        const toNodeId = Link.getLinkInputNodeId(link);
        const toPinKey = Link.getLinkInputPinKey(link);

        const [inputPinKey, outputPinKey] = getCastNodePinKeys(
          project,
          castNode
        );

        const toCastNode = R.assoc(
          'id',
          `${origLinkId}-to-cast`,
          Link.createLink(inputPinKey, castNode.id, fromPinKey, fromNodeId)
        );
        const fromCastNode = R.assoc(
          'id',
          `${origLinkId}-from-cast`,
          Link.createLink(toPinKey, toNodeId, outputPinKey, castNode.id)
        );

        return [castNode, [toCastNode, fromCastNode]];
      }
    ),
    createCastNode
  )(patchTuples, nodes, link)
);

// :: [{ nodeId, pinKey, value }] -> StrMap Node -> StrMap Node
const bindValuesToIndexedNodes = R.curry((valuesToBind, nodesById) =>
  R.reduce(
    (indexedNodes, { nodeId, pinKey, value }) =>
      R.over(
        R.lensProp(nodeId),
        Node.setBoundValue(pinKey, value),
        indexedNodes
      ),
    nodesById,
    valuesToBind
  )
);

// :: StrMap Node -> NodeId -> Boolean
const isNodeWithIdTerminal = R.uncurryN(2, nodesById =>
  R.compose(isInternalTerminalNode, R.flip(R.prop)(nodesById))
);

// :: StrMap Node -> Link -> Boolean
const isLinkFromTerminalToRegularNode = R.uncurryN(2, nodesById =>
  R.both(
    R.compose(isNodeWithIdTerminal(nodesById), Link.getLinkOutputNodeId),
    R.compose(
      R.complement(isNodeWithIdTerminal(nodesById)),
      Link.getLinkInputNodeId
    )
  )
);

// Collects all the links
//
//    Regular node
//         | <---- ... to here
//      Terminal
//         |
//      Terminal
//         | <--- starting from here ...
//    Regular node
//
// So returned array will always start with link from "regular" node input to terminal output,
// then it may contain some links from terminal to terminal
// and finally in may end with a link from terminl input to "regular" node output
//
// :: StrMap NodeId Node -> StrMap NodeId Link -> Link -> [Link]
const getTerminalLinksChain = R.curry(
  (nodesById, linksByInputNodeId, startingLink) =>
    (function recur(linksChain) {
      const nextLinkInChain =
        linksByInputNodeId[Link.getLinkOutputNodeId(R.last(linksChain))];

      // Special case for when there is a 'dangling' terminal node.
      //
      //      Terminal  <----
      //         |
      //      Terminal
      //         |
      //    Regular node
      if (!nextLinkInChain) return linksChain;

      const reachedTheEnd = R.compose(
        R.complement(isNodeWithIdTerminal(nodesById)),
        Link.getLinkOutputNodeId
      )(nextLinkInChain);

      const newLinksChain = R.append(nextLinkInChain, linksChain);

      if (reachedTheEnd) {
        return newLinksChain;
      }

      return recur(newLinksChain);
    })([startingLink])
);

// :: [NodeId] -> Link -> Boolean
const isLinkConnectedToNodeIds = R.curry((nodeIds, link) =>
  R.or(
    R.contains(Link.getLinkInputNodeId(link), nodeIds),
    R.contains(Link.getLinkOutputNodeId(link), nodeIds)
  )
);

// :: ([a] → a | undefined) -> PinKey -> [Node] -> Maybe DataValue
const findBoundValue = R.uncurryN(3)((findFn, pinKey) =>
  R.compose(Maybe, findFn, catMaybies, R.map(Node.getBoundValue(pinKey)))
);

// :: StrMap Node -> [Link] -> Maybe { nodeId, pinKey, value }
const getValueToBind = R.curry((nodesById, linksChain) => {
  const outputNodesFromLinkChain = R.map(
    R.compose(R.flip(R.prop)(nodesById), Link.getLinkOutputNodeId)
  )(linksChain);

  const topNode = R.last(outputNodesFromLinkChain);

  // special case — top node is a constant
  const topNodeIsConstant = R.compose(
    PatchPathUtils.isConstantNodeType,
    Node.getNodeType
  )(topNode);
  if (topNodeIsConstant) {
    // no need to rebind anything — links chain can be safely collapsed,
    // and value from constant node will freely propagate down
    return Maybe.Nothing();
  }

  const isTopNodeTerminal = isInternalTerminalNode(topNode);

  // Example:
  //   We have some node that wraps `count` node.
  //   We should be able to pass initial value to
  //   up to count's output
  //
  //    | +-------+     |
  //    | | count | ... |
  //    | +-O-----+     |
  //    |   |           |
  //    +---O-----------+
  //        |\
  //        | \--- here some initial value is bound
  //        |
  //    +---O-----------+
  //    |   |           |
  //    | +-O-----+     |
  //    | |  ...  | ... |
  if (!isTopNodeTerminal) {
    const topOutputTermianls = R.compose(
      R.takeLastWhile(
        R.compose(
          R.equals(CONST.PIN_DIRECTION.OUTPUT),
          R.view(terminalOriginalDirectionLens)
        )
      ),
      R.init // Because top node is not a terminal
    )(outputNodesFromLinkChain);

    return findBoundValue(
      R.head,
      getPinKeyForTerminalDirection(CONST.PIN_DIRECTION.OUTPUT),
      topOutputTermianls
    ).map(bottomBoundValue => {
      const topLink = R.last(linksChain);
      return {
        nodeId: Link.getLinkOutputNodeId(topLink),
        pinKey: Link.getLinkOutputPinKey(topLink),
        value: bottomBoundValue,
      };
    });
  }

  // special case — "custom" constant nodes
  const topTerminalWasOutput = R.equals(
    CONST.PIN_DIRECTION.OUTPUT,
    R.view(terminalOriginalDirectionLens, topNode)
  );
  const maybeTopTerminalBoundValue = Node.getBoundValue(
    getPinKeyForTerminalDirection(CONST.PIN_DIRECTION.OUTPUT),
    topNode
  );
  if (
    isTopNodeTerminal &&
    topTerminalWasOutput &&
    Maybe.isJust(maybeTopTerminalBoundValue)
  ) {
    const value = explodeMaybe(
      'maybeTopTerminalBoundValue is guaranteed to be Just at this point',
      maybeTopTerminalBoundValue
    );
    const bottomLink = R.head(linksChain);

    return Maybe.Just({
      nodeId: Link.getLinkInputNodeId(bottomLink),
      pinKey: Link.getLinkInputPinKey(bottomLink),
      value,
    });
  }

  // We must take bound value from the 'highest' terminal node
  // and bind it to 'base' node input
  //
  // Example:
  //   `led` passes value bound to it's PORT pin
  //   to pwm-output's PORT pin inside it's implementation
  //
  //               ...
  //        PORT    |
  //    +----O------O----+
  //    |    |           |
  //    |    |     ...   |
  //    |    |           |
  //    | +--O------O--+ |
  //    | | pwm-output | |
  //    | +------------+ |
  //    +----------------+
  return findBoundValue(
    R.last,
    getPinKeyForTerminalDirection(CONST.PIN_DIRECTION.INPUT),
    outputNodesFromLinkChain
  ).map(topBoundValue => {
    const bottomLink = R.head(linksChain);
    return {
      nodeId: Link.getLinkInputNodeId(bottomLink),
      pinKey: Link.getLinkInputPinKey(bottomLink),
      value: topBoundValue,
    };
  });
});

// :: [Link] -> Link
const collapseLinksChain = linksChain => {
  const firstLink = R.head(linksChain);
  const lastLink = R.last(linksChain);

  const linkId = Link.getLinkId(firstLink);
  const newLink = Link.createLink(
    Link.getLinkInputPinKey(firstLink),
    Link.getLinkInputNodeId(firstLink),
    Link.getLinkOutputPinKey(lastLink),
    Link.getLinkOutputNodeId(lastLink)
  );

  return R.assoc('id', linkId, newLink);
};

// :: StrMap Node -> StrMap Link -> [Link] -> Pair [Link] [{ nodeId, pinKey, value }]
const getCollapsedLinksAndValuesToBind = R.uncurryN(3)(
  (nodesById, linksByInputNodeId) =>
    R.compose(
      R.adjust(catMaybies, 1),
      R.when(R.isEmpty, R.always([[], []])),
      R.transpose, // [Pair Link ValueToBind] -> Pair [Link] [ValueToBind]
      R.map(
        R.compose(
          // :: [Link] -> [Pair Link ValueToBind]
          R.converge(R.pair, [collapseLinksChain, getValueToBind(nodesById)]),
          getTerminalLinksChain(nodesById, linksByInputNodeId)
        )
      ),
      R.filter(isLinkFromTerminalToRegularNode(nodesById))
    )
);

// 'collapses' links containing terminals,
//
//     +------------+                          +------------+
//     |   latch    |                          |   latch    |
//     +-----o------+                          +-----o------+
//           |                                       |
//    +------O-------+                       +-------+-----+------+
//    | terminalBool |          -->          |             |      |
//    +------o-------+                       |             |      |
//           |                               |             |      |
//   +-------+-----+------+                  |             |      |
//   |             |      |                  |             |      |
// +-O------O-+  +-O------O-+              +-O------O-+  +-O------O-+
// |    or    |  |    or    |              |    or    |  |    or    |
// +----o-----+  +----o-----+              +----o-----+  +----o-----+
//
// removes terminal nodes,
// and rebinds values bound to terminals  to 'real' nodes
//
// :: [ Node[], Link[] ] -> [ Node[], Link[] ]
const removeTerminalsAndPassPins = ([nodes, links]) => {
  const nodesById = R.indexBy(Node.getNodeId, nodes);
  const linksByInputNodeId = R.indexBy(Link.getLinkInputNodeId, links);

  const [
    collapsedTerminalLinks,
    valuesToBind,
  ] = getCollapsedLinksAndValuesToBind(nodesById, linksByInputNodeId, links);

  const terminalNodeIds = R.compose(
    R.map(Node.getNodeId),
    R.filter(isInternalTerminalNode)
  )(nodes);

  const newLinks = R.compose(
    R.reject(isLinkConnectedToNodeIds(terminalNodeIds)),
    R.concat(collapsedTerminalLinks)
  )(links);

  const newNodes = R.compose(
    R.reject(isInternalTerminalNode),
    R.values,
    bindValuesToIndexedNodes(valuesToBind)
  )(nodesById);

  return [newNodes, newLinks];
};

const isLinkOutputNodeIdOneOf = R.curry((terminalNodeIds, link) =>
  R.compose(isAmong(terminalNodeIds), Link.getLinkOutputNodeId)(link)
);

// It collects the full chain of nodeIds and links from the lowermost to
// uppermost links.
// Links collected in order from lowermost to uppermost.
// NodeIds collected to omit Nodes that replaced with a new link.
// If the last link in array linked with terminal node — it calls recursively.
// :: [NodeId] -> [Link] -> [[NodeId], [Link]]
const traverseUpAndCollectTerminalChain = R.curry(
  (terminalNodeIds, links, collected) => {
    const curLink = R.last(collected[1]);

    if (isLinkOutputNodeIdOneOf(terminalNodeIds, curLink)) {
      // collect nodeId + next link & run recursion
      const nextNodeId = Link.getLinkOutputNodeId(curLink);
      const nextLink = R.find(
        R.compose(R.equals(nextNodeId), Link.getLinkInputNodeId),
        links
      );
      // If the upper terminal node has no input link — return tuple of empty lists
      // to avoid removing this chain of terminals, because it will be done in the
      // further step with passing bound values
      if (!nextLink) return [[], []];

      return R.compose(
        traverseUpAndCollectTerminalChain(terminalNodeIds, links),
        R.over(R.lensIndex(0), R.append(nextNodeId)),
        R.over(R.lensIndex(1), R.append(nextLink))
      )(collected);
    }
    return collected;
  }
);

// Replaces generic internal terminals (`xod/internal/terminal-t1`) with
// cast node if needed or just create a direct link from uppermost output pin
// to the lowermost input pin, which are connected through any amount of internal
// generic terminals (any nesting level).
// :: Project -> [[PatchPath, Patch]] -> [[Node], [Link]] -> [[Node], [Link]]
const replaceGenericTerminalsWithCastNodes = R.curry(
  (project, patchTuples, [nodes, links]) => {
    const terminalNodeIds = R.compose(
      R.map(Node.getNodeId),
      R.filter(R.both(isInternalTerminalNode, isGenericInternalTerminal))
    )(nodes);

    if (terminalNodeIds.length === 0) return [nodes, links];

    const linksConnectedToTerminals = R.filter(
      R.compose(
        linkNodeIds => R.any(isAmong(linkNodeIds), terminalNodeIds),
        Link.getLinkNodeIds
      ),
      links
    );

    const lowermostTerminalLinks = R.filter(
      R.either(
        // link inputs into non terminal node
        R.compose(
          R.complement(isAmong(terminalNodeIds)),
          Link.getLinkInputNodeId
        ),
        // or into terminal node, which not have a links below
        R.compose(
          R.not,
          R.find(R.__, links),
          Link.isLinkOutputNodeIdEquals,
          Link.getLinkInputNodeId
        )
      ),
      linksConnectedToTerminals
    );

    // For each lowermost link find the full chain to the uppermost link and
    // colleact all links and NodeIds in the arrays.
    // Links collected in order from lowermost to uppermost, so first and last
    // links in array will be used to create a new link.
    // NodeIds collected to omit Nodes that replaced with a new link.
    // :: [[NodeId, Link]]
    const terminalChains = R.map(lowermostLink =>
      traverseUpAndCollectTerminalChain(
        terminalNodeIds,
        linksConnectedToTerminals,
        [[], [lowermostLink]]
      )
    )(lowermostTerminalLinks);

    const directLinks = R.compose(
      R.reject(R.isNil),
      R.map(([_, _links]) => {
        if (_links.length <= 1) return null;

        const lowermost = R.head(_links);
        const uppermost = R.last(_links);

        const lowermostId = Link.getLinkId(lowermost);
        const uppermostId = Link.getLinkId(uppermost);

        const inputPinKey = Link.getLinkInputPinKey(lowermost);
        const inputNodeId = Link.getLinkInputNodeId(lowermost);
        const outputPinKey = Link.getLinkOutputPinKey(uppermost);
        const outputNodeId = Link.getLinkOutputNodeId(uppermost);

        return R.compose(
          R.assoc('id', `${uppermostId}-to-${lowermostId}`),
          Link.createLink
        )(inputPinKey, inputNodeId, outputPinKey, outputNodeId);
      })
    )(terminalChains);

    const nodeIdsToOmit = R.compose(R.flatten, R.pluck(0))(terminalChains);
    const linkIdsToOmit = R.compose(
      R.map(Link.getLinkId),
      R.flatten,
      R.pluck(1)
    )(terminalChains);

    const nodesWithoutTerminals = R.reject(
      R.compose(isAmong(nodeIdsToOmit), Node.getNodeId),
      nodes
    );
    const linksWithoutTerminalLinks = R.reject(
      R.compose(isAmong(linkIdsToOmit), Link.getLinkId),
      links
    );
    const newNodesAndLinks = R.map(
      splitLinkWithCastNode(project, patchTuples, nodesWithoutTerminals),
      directLinks
    );

    return R.converge(R.pair, [
      R.compose(R.concat(nodesWithoutTerminals), R.reject(R.isNil), R.pluck(0)),
      R.compose(R.concat(linksWithoutTerminalLinks), R.flatten, R.pluck(1)),
    ])(newNodesAndLinks);
  }
);

/**
 * It replaces links with casting nodes and new links.
 *
 * See {@link flatten} docs (2.3)
 *
 * @private
 * @function createCastNodes
 * @param {Project} project
 * @param {Array<Array<Path, Patch>>} patchTuples
 * @param {Array<Node>} nodes
 * @param {Array<Link>} links
 * @returns {Array<Array<Node>, Array<Link>>}
 */
// :: Project -> [[Path, Patch]] -> Node[] -> Link[] -> [ Node[], Link[] ]
const createCastNodes = R.curry((project, patchTuples, nodes, links) =>
  R.compose(
    removeTerminalsAndPassPins,
    replaceGenericTerminalsWithCastNodes(project, patchTuples),
    R.converge((newNodes, newLinks) => [newNodes, newLinks], [
      R.compose(R.concat(nodes), R.reject(R.isNil), R.pluck(0)),
      R.compose(R.flatten, R.pluck(1)),
    ]),
    R.map(splitLinkWithCastNode(project, patchTuples, nodes))
  )(links)
);

// :: [[Path, Patch]] -> [[Path, Patch]]
const filterTuplesByUniqPaths = R.uniqWith(R.eqBy(R.prop(0)));

// :: leafPatchesPaths -> String -> Patch -> Link -> Link
const updateLinkNodeIds = R.curry((leafPaths, prefix, patch, link) => {
  const inputNodeId = Link.getLinkInputNodeId(link);
  const inputPinKey = Link.getLinkInputPinKey(link);
  const isInputLeafNode = R.compose(isLeafNode(leafPaths), getNodeById(patch))(
    inputNodeId
  );
  const newInputNodeId = isInputLeafNode
    ? getPrefixedId(prefix, inputNodeId)
    : getPrefixedId(prefix, getPrefixedId(inputNodeId, inputPinKey));
  const newInputPinKey = isInputLeafNode
    ? inputPinKey
    : CONST.TERMINAL_PIN_KEYS[CONST.PIN_DIRECTION.INPUT];

  const outputNodeId = Link.getLinkOutputNodeId(link);
  const outputPinKey = Link.getLinkOutputPinKey(link);
  const isOutputLeafNode = R.compose(
    isLeafNode(leafPaths),
    explode,
    Patch.getNodeById(R.__, patch)
  )(outputNodeId);
  const newOutputNodeId = isOutputLeafNode
    ? getPrefixedId(prefix, outputNodeId)
    : getPrefixedId(prefix, getPrefixedId(outputNodeId, outputPinKey));
  const newOutputPinKey = isOutputLeafNode
    ? outputPinKey
    : CONST.TERMINAL_PIN_KEYS[CONST.PIN_DIRECTION.OUTPUT];

  return R.compose(
    R.assoc('id', getPrefixedId(prefix, Link.getLinkId(link))),
    Link.createLink
  )(newInputPinKey, newInputNodeId, newOutputPinKey, newOutputNodeId);
});

// =============================================================================
//
// General flattening functions
//
// =============================================================================
//
// Flow of general flattening function calls:
//     flatten -> validatePatchReqursively -> getPatchByPath (or Error) ->
//  -> flattenProject -> extractLeafPatches -> convertProject ->
//  -> convertPatch -> extractPatches
//

// :: Node -> Boolean
const isTerminalNode = R.compose(
  PatchPathUtils.isTerminalPatchPath,
  Node.getNodeType
);

// :: NodePins -> Node -> NodePins
const rekeyBoundValues = R.curry((boundValues, node) => {
  // TODO: better name?
  const nodeId = Node.getNodeId(node);

  if (isTerminalNode(node) && R.has(nodeId, boundValues)) {
    const terminalPinKey = R.compose(
      getPinKeyForTerminalDirection,
      PatchPathUtils.getTerminalDirection,
      Node.getNodeType
    )(node);

    return R.applySpec({
      [terminalPinKey]: R.prop(nodeId),
    })(boundValues);
  }

  return Node.getAllBoundValues(node);
});

const convertTerminalToInternalTerminal = R.when(isTerminalNode, node => {
  const nodeType = Node.getNodeType(node);
  return R.compose(
    Node.setNodeType(PatchPathUtils.convertToInternalTerminalPath(nodeType)),
    R.set(
      terminalOriginalDirectionLens,
      PatchPathUtils.getTerminalDirection(nodeType)
    )
  )(node);
});

/**
 * Extract all patches nodes and links recursvely.
 *
 * It returns nodes and links wrapped by NodeWrapper or LinkWrapper,
 * and it can't unnest it in this function, cause it recursive.
 *
 * We have to unwrap it in the caller function, just by
 * `R.map(R.map(R.unnest))` and we'll get `[Node[], Link[]]`.
 *
 * It represents a steps 2.1 and 2.2 from {@link flatten} docs.
 *
 * @private
 * @function extractPatches
 * @param {Project} project The original project
 * @param {Array<Path>} leafPatchesPaths Paths to leaf patches
 * @param {String|null} prefix Prefixed parent nodeId (prefixed) or null (for entry-point patch)
 * @param {Array<NodePin>} boundValues Pins data from parent node or empty object
 * @param {Patch} patch The patch from which should be extracted nodes and links
 * @returns {Array<Array<NodeWrapper>, Array<LinkWrapper>>}
 */
// :: Project -> leafPatchesPaths -> String -> NodePins -> Patch -> [NodeWrapper[], LinkWrapper[]]
export const extractPatches = R.curry(
  (project, leafPaths, prefix, boundValues, patch) => {
    // 1. extractPatches recursively from nodes and wrap with NodeWrapper leafNodes
    const nodes = R.compose(
      R.map(
        R.ifElse(
          isLeafNode(leafPaths),
          R.compose(
            Wr.Node,
            // 1.3. update id
            node =>
              R.assoc('id', getPrefixedId(prefix, Node.getNodeId(node)), node),
            // 1.2. convert node type from 'input|output' to 'terminal', if needed
            convertTerminalToInternalTerminal,
            // 1.1. Copy and rekey pins from parent node
            node =>
              R.assoc(
                'boundLiterals',
                rekeyBoundValues(boundValues, node),
                node
              )
          ),
          R.converge(extractPatches(project, leafPaths), [
            R.compose(getPrefixedId(prefix), Node.getNodeId),
            Node.getAllBoundValues,
            R.compose(
              Project.getPatchByPathUnsafe(R.__, project),
              Node.getNodeType
            ),
          ])
        )
      ),
      R.reject(
        R.compose(R.equals(CONST.NOT_IMPLEMENTED_IN_XOD_PATH), Node.getNodeType)
      ),
      Patch.listNodes
    )(patch);
    // 2. extract links inside this patch, update nodeIds using prefix and wrap with LinkWrapper
    const links = R.compose(
      R.map(R.compose(Wr.Link, updateLinkNodeIds(leafPaths, prefix, patch))),
      Patch.listLinks
    )(patch);

    // 3. group by type
    return R.compose(
      R.converge(R.append, [
        R.compose(R.concat(R.__, links), R.filter(Wr.isLink)),
        R.compose(R.of, R.filter(Wr.isNode)),
      ]),
      R.flatten
    )(nodes);
  }
);

/**
 * Converting old patch into new patch.
 *
 * See {@link flatten} docs (2)
 *
 * @private
 * @function convertPatch
 * @param {Project} project
 * @param {Array<Array<Path, Patch>>} leafPatches
 * @param {Patch} patch
 * @returns {Patch}
 */
const convertPatch = def(
  'convertPatch :: Project -> [Pair PatchPath Patch] -> Patch -> Patch',
  (project, leafPatches, patch) =>
    R.unless(Patch.isPatchNotImplementedInXod, originalPatch => {
      const leafPatchPaths = R.pluck(0, leafPatches);
      const flattenEntities = extractPatches(
        project,
        leafPatchPaths,
        null,
        {},
        originalPatch
      );
      const nodes = R.map(R.unnest, flattenEntities[0]);
      const links = R.map(R.unnest, flattenEntities[1]);
      const [newNodes, newLinks] = createCastNodes(
        project,
        leafPatches,
        nodes,
        links
      );

      return R.compose(
        Patch.upsertLinks(newLinks),
        Patch.upsertNodes(newNodes)
      )(Patch.createPatch());
    })(patch)
);

//
// It represents a first step of flattening.
// (see flatten docs (1))
// And then passing leafPatches into convertProject function, which represents estimated steps.
//
// Project and patch was validated in the parent function, so in this function we
// already have a completely valid Project and Patch.
//
/**
 * Extracting leaf patches, filter unique leaf patches by path
 * and begin converting project.
 *
 * See {@link flatten} docs (1)
 *
 * @private
 * @function flattenProject
 * @param {Project} project
 * @param {String} path - Path to entry-point patch
 * @param {Patch} patch - Entry-point patch
 * @returns {Either<Error|Project>}
 */
const flattenProject = def(
  'flattenProject :: Project -> PatchPath -> Patch -> Either Error Project',
  (project, path, patch) =>
    R.compose(
      R.chain(leafPatches =>
        R.compose(
          R.map(Project.assocPatch(path, R.__, project)),
          Project.validatePatchContents(R.__, project),
          convertPatch
        )(project, leafPatches, patch)
      ),
      // TODO: extract preparing leaf patches into a separate function?
      // end preparing leaf patches list
      R.map(R.map(extendTerminalPins)),
      R.map(filterTuplesByUniqPaths),
      R.sequence(Either.of),
      extractLeafPatches(project, path)
      // start preparing leaf patches list
    )(patch)
);

const checkEntryPatchIsNative = def(
  'checkEntryPatchIsNative :: Patch -> Either Error Patch',
  patch =>
    R.ifElse(
      Patch.isPatchNotImplementedInXod,
      () =>
        fail('CPP_AS_ENTRY_POINT', { patchPath: Patch.getPatchPath(patch) }),
      Either.of
    )(patch)
);

const checkEntryPatchIsNotAbstract = def(
  'checkEntryPatchIsNotAbstract :: Patch -> Either Error Patch',
  patch =>
    R.ifElse(
      Patch.isAbstractPatch,
      () =>
        fail('ABSTRACT_AS_ENTRY_POINT', {
          patchPath: Patch.getPatchPath(patch),
        }),
      Either.of
    )(patch)
);

/**
 * Flattens project
 *
 * To transpile project into any native language we need a flattened graph of nodes
 * with implementations for target platform. It replaces all nodes with contents of
 * their patches recursively, place nodes, which casts one type into another one
 * on every link between pins with different types.
 *
 *
 * **How we do it?**
 * Before begin to flatten, we're check passed project for validity
 * and check for existence of entry-point patch.
 *
 * Then we start flattening from entry-point patch (second argument of function),
 * so as a result we'll get only used patches.
 *
 * 1. Get all patches with defined implementations or terminal patches.
 *    And name them "leaf patches". We will reference them later.
 *    Terminal nodes are replaced with a new temporary type "xod/internal/terminal-%TYPE%"
 *    (e.g. xod/patch-nodes/input-boolean becomes xod/internal/terminal-boolean).
 *    They get two pins: `__in__` and `__out__`.
 *
 * 2. Convert entry-point patch into a new patch:
 *
 *    2.1. Extract all nodes recursively.
 *         Each node will become array of new nodes,
 *         that have new ids and type of one of leaf patches.
 *         New ids get form "parentNodehId~subNodeId~nodeId".
 *
 *    2.2. Update links according to extracted nodes.
 *         Links will have new ids, new node ids, and pin keys.
 *         Link ids get form "parentNodeId~subNodeId~linkId".
 *         Pin keys stay intact unless link points to a terminal node.
 *         In this case the pin key is replaced with `__in__` or `__out__`.
 *
 *    2.3. Replace terminal nodes and links with cast nodes and links.
 *         It removes terminal nodes, places cast nodes (from type to type),
 *         and creates new links. Sometimes it just removes terminals, if
 *         both pins have the same type (if we don't need a casting).
 *         Also we copy injected pins from terminals, if they have it.
 *         E.g.
 *
 *    2.4. Assoc new nodes and new links to a new patch.
 *
 * 3. Replace original entry patch with the flattened one.
 *
 * @function flatten
 * @param {Project} inputProject
 * @param {string} path - Path of entry-point patch
 * @returns {Either<Error|Project>}
 */
export default def(
  'flatten :: Project -> PatchPath -> Either Error Project',
  (inputProject, path) =>
    R.compose(
      R.chain(project =>
        R.compose(
          R.chain(flattenProject(project, path)),
          R.chain(checkEntryPatchIsNative),
          R.chain(checkEntryPatchIsNotAbstract),
          failOnNothing('ENTRY_POINT_PATCH_NOT_FOUND_BY_PATH', {
            patchPath: path,
          }),
          Project.getPatchByPath(path)
        )(project)
      ),
      Project.validatePatchReqursively(path)
    )(inputProject)
);
