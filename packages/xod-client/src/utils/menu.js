import * as R from 'ramda';
import { HOTKEY, ELECTRON_ACCELERATOR, COMMAND } from './constants';
import { isMacOS } from './browser';

const rawItems = {
  file: {
    label: 'Archivo',
  },
  newProject: {
    label: 'Nuevo proyecto...',
    command: COMMAND.NEW_PROJECT,
  },
  openProject: {
    label: 'Abrir Proyecto...',
    command: COMMAND.OPEN_PROJECT,
  },
  openTutorialProject: {
    label: 'Abrir proyecto tutorial',
  },
  save: {
    label: 'Guardar',
    command: COMMAND.SAVE,
  },
  saveAs: {
    label: 'Guardar como...',
    command: COMMAND.SAVE_AS,
  },
  saveCopyAs: {
    label: 'Guardar copia como...',
    command: COMMAND.SAVE_COPY_AS,
  },
  switchWorkspace: {
    label: 'Cambiar espacio de trabajo...',
  },
  importProject: {
    label: 'Importar proyecto...',
  },
  exportProject: {
    label: 'Exportar Proyecto...',
  },
  newPatch: {
    label: 'Nuevo Patch...',
    command: COMMAND.ADD_PATCH,
  },
  addLibrary: {
    label: 'Agregar Libreria...',
  },
  publish: {
    label: 'Publicar Libreria...',
  },
  exit: {
    label: 'Salir',
  },

  edit: {
    label: 'Editar',
  },
  undo: {
    label: 'Deshacer',
    command: COMMAND.UNDO,
  },
  redo: {
    label: 'Rehacer',
    command: COMMAND.REDO,
  },
  cut: {
    label: 'Cortar',
    role: 'cut',
    command: COMMAND.CUT,
  },
  copy: {
    label: 'Copiar',
    command: COMMAND.COPY,
    role: 'copy',
  },
  paste: {
    label: 'Pegar',
    command: COMMAND.PASTE,
    role: 'paste',
  },
  selectall: {
    label: 'Seleccionar todo',
    command: COMMAND.SELECT_ALL,
  },
  projectPreferences: {
    label: 'Preferencias del proyecto',
  },
  insertComment: {
    label: 'Insertar comentario',
  },
  insertNode: {
    label: 'Insertar nodo...',
    command: COMMAND.INSERT_NODE,
  },
  splitLinksToBuses: {
    label: 'Convertir los Links seleccionados a Buses',
    command: COMMAND.MAKE_BUS,
  },

  deploy: {
    label: 'Implementar',
  },
  showCodeForArduino: {
    label: 'Mostrar código para Arduino',
  },
  uploadToArduino: {
    label: 'Subir a Arduino...',
  },
  connectSerial: {
    label: 'Conectar Serial...',
  },
  updatePackages: {
    label: 'Actualizar Paquetes de Arduino && Toolchains...',
  },
  runSimulation: {
    label: 'Simular',
  },

  view: {
    label: 'Ver',
  },
  toggleHelp: {
    label: 'Alternar barra de ayuda',
    command: COMMAND.TOGGLE_HELP,
  },
  toggleDebugger: {
    label: 'Alternar panel de implementación',
    command: COMMAND.TOGGLE_DEBUGGER,
  },
  toggleAccountPane: {
    label: 'Alternar panel de reporte',
  },
  toggleProjectBrowser: {
    label: 'Alternar navegador de proyectos',
  },
  toggleInspector: {
    label: 'Alternar Inspector',
  },
  panToOrigin: {
    label: 'Panorámica al origen',
    command: COMMAND.PAN_TO_ORIGIN,
  },
  panToCenter: {
    label: 'Panorámica al centro',
    command: COMMAND.PAN_TO_CENTER,
  },

  help: {
    label: 'Ayuda',
  },
  documentation: {
    label: 'Documentación',
  },
  shortcuts: {
    label: 'Accesos directos',
  },
  forum: {
    label: 'Foro',
  },
};

const containsCmd = R.contains('command');

// :: String -> String
const unfoldCmdOrCtrl = R.ifElse(
  () => isMacOS(),
  R.replace(/CmdOrCtrl/gi, 'command'),
  R.replace(/CmdOrCtrl/gi, 'ctrl')
);

/**
 * Filters OS-specific hotkeys.
 *
 * E.G.,
 * `['ctrl+a', 'command+a']`
 * will become ['ctrl+a'] on Windows / Linux
 * and ['command+a'] on MacOS
 *
 * But in case there are only 'ctrl+a' hotkey defined
 * it will be left untouched on MacOS.
 *
 * :: String|[String] -> [String]
 */
export const filterOsHotkeys = R.compose(
  R.map(unfoldCmdOrCtrl),
  R.ifElse(
    () => isMacOS(),
    R.when(R.any(containsCmd), R.filter(containsCmd)),
    R.reject(containsCmd)
  ),
  R.unless(R.is(Array), R.of)
);

const assignHotkeys = menuItem =>
  R.when(
    R.prop('command'),
    R.merge({
      hotkey: R.compose(filterOsHotkeys, R.propOr([], menuItem.command))(
        HOTKEY
      ),
      accelerator: ELECTRON_ACCELERATOR[menuItem.command],
    }),
    menuItem
  );

export const items = R.compose(
  // separator item is secial and sould not have `key` or hotkey-related props
  R.assoc('separator', { type: 'separator' }),
  R.map(assignHotkeys),
  R.mapObjIndexed((menuItem, key) => R.assoc('key', key, menuItem))
)(rawItems);

/** add click handler to menu item */
export const onClick = R.flip(R.assoc('click'));

/** add children items to menu item */
export const submenu = R.flip(R.assoc('submenu'));

/** returns hotkeys key map with filtered OS specific key mapping */
export const getOsSpecificHotkeys = () => R.map(filterOsHotkeys, HOTKEY);
