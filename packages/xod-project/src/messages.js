import { enumerate } from 'xod-func-tools';

// Stanza creators.
// See `xod-func-tools` package Stanza type
export default {
  // Patch
  INVALID_PATCH_PATH: ({ patchPath }) => ({
    title: 'Ruta de path no válida',
    note: `La ruta "${patchPath}" está vacía o contiene caracteres no válidos`,
  }),
  PATCH_NOT_FOUND_BY_PATH: ({ patchPath }) => ({
    title: 'Patch no encontrado',
    note: `No puedo encontrar el path en el proyecto con la ruta especificada: "${patchPath}"`,
  }),
  CANT_UPDATE_PATCH__PATCH_NOT_FOUND_BY_PATH: ({ patchPath }) => ({
    title: "No se puede actualizar el patch",
    note: `No puedo encontrar el patch en el proyecto con la ruta especificada: "${patchPath}"`,
  }),
  CANT_CLONE_PATCH__PATCH_NOT_FOUN_BY_PATH: ({ patchPath }) => ({
    title: "No se puede clonar el patch",
    note: `No puedo encontrar el patch en el proyecto con la ruta especificada: "${patchPath}"`,
  }),

  // Generics, Abstracts and etc
  ALL_TYPES_MUST_BE_RESOLVED: ({ patchPath, currentPatchPath, trace }) => ({
    title: 'El proyecto contiene patchs abstractos sin resolver',
    note: ` El patch "${currentPatchPath}" contiene un nodo abstracto "${patchPath}" que no se puede resolver`,
    trace,
  }),
  GENERIC_TERMINALS_REQUIRED: ({ trace }) => ({
    title: 'Parche abstracto no válido',
    note: 'Se requiere al menos un terminal genérico',
    trace,
  }),
  ORPHAN_GENERIC_OUTPUTS: ({ trace, types }) => ({
    title: 'Parche abstracto no válido',
    note: `Para cada salida genérica debe haber al menos una entrada genérica del mismo tipo. Crear ${types
      .map(x => `input-${x}`)
      .join(', ')}`,
    trace,
  }),
  NONSEQUENTIAL_GENERIC_TERMINALS: ({ trace, types }) => ({
    title: 'Parche abstracto no válido',
    note: `Las entradas genéricas deben emplearse de forma secuencial. Utilice ${types.join(
      ', '
    )}`,
    trace,
  }),
  CANT_FIND_SPECIALIZATIONS_FOR_ABSTRACT_PATCH: ({
    patchPath,
    expectedSpecializationName,
    trace,
  }) => ({
    title: 'No se encontró el parche de especialización',
    note: `No se puede encontrar la especialización ${expectedSpecializationName} para el resumen ${patchPath}.`,
    solution:
      'Intente crear el parche que falta en su proyecto o instale una libreria que proporcione uno.',
    trace,
  }),
  CONFLICTING_SPECIALIZATIONS_FOR_ABSTRACT_PATCH: ({
    patchPath,
    conflictingSpecializations,
    trace,
  }) => ({
    title: `Especializaciones en conflicto para el parche abstracto ${patchPath}`,
    note: `Para continuar, cambie explícitamente a ${enumerate(
      ', ',
      ' or ',
      conflictingSpecializations
    )}`,
    trace,
  }),
  SPECIALIZATION_PATCH_CANT_BE_ABSTRACT: ({ trace }) => ({
    title: 'Este error aún no debería ser visible para el usuario final',
    trace,
  }),
  SPECIALIZATION_PATCH_MUST_HAVE_SAME_ARITY_LEVEL: ({ trace }) => ({
    title: 'Este error aún no debería ser visible para el usuario final',
    trace,
  }),
  SPECIALIZATION_PATCH_CANT_HAVE_GENERIC_PINS: ({ trace }) => ({
    title: 'Este error aún no debería ser visible para el usuario final',
    trace,
  }),
  SPECIALIZATION_PATCH_MUST_HAVE_N_INPUTS: ({ trace }) => ({
    title: 'Este error aún no debería ser visible para el usuario final',
    trace,
  }),
  SPECIALIZATION_PATCH_MUST_HAVE_N_OUTPUTS: ({ trace }) => ({
    title: 'Este error aún no debería ser visible para el usuario final',
    trace,
  }),
  SPECIALIZATION_STATIC_PINS_DO_NOT_MATCH: ({ trace }) => ({
    title: 'Este error aún no debería ser visible para el usuario final',
    trace,
  }),
  SPECIALIZATION_HAS_CONFLICTING_TYPES_FOR_GENERIC: ({ trace }) => ({
    title: 'Este error aún no debería ser visible para el usuario final',
    trace,
  }),
  SPECIALIZATION_HAS_WRONG_NAME: ({ trace }) => ({
    title: 'Este error aún no debería ser visible para el usuario final',
    trace,
  }),
  NO_DEDUCED_TYPES_FOUND_FOR_GENERIC_NODE: ({ trace }) => ({
    title: "No se pueden deducir los tipos de parche",
    solution: 'Conectar enlaces o vincular valores a entradas genéricas',
    trace,
  }),
  CONFLICTING_TYPES_FOR_NODE: ({
    trace,
    genericPinType,
    conflictingTypes,
  }) => ({
    title: 'Los tipos genéricos no coinciden',
    note: `Types ${enumerate(
      ', ',
      ' and ',
      conflictingTypes
    )} conflict; ${genericPinType} can’t be resolved unambiguously.`,
    solution:
      'Agregue nodos a un solo tipo o cambie a una especialización de nodo en particular.',
    trace,
  }),
  UNRESOLVED_GENERIC_PIN: ({ trace, unresolvedPinType }) => ({
    title: "No se puede resolver el tipo para el pin",
    note: `El pin con el tipo ${unresolvedPinType} no se puede resolver`,
    solution: `Conectar un enlace o vincularle un valor`,
    trace,
  }),
  UNRESOLVED_ABSTRACT_NODES_LEFT: ({ unresolvedNodeTypes }) => ({
    title: 'El proyecto contiene nodos abstractos sin resolver',
    note: `Asegúrese de que el nodo${
      unresolvedNodeTypes.lenght === 1 ? '' : 's'
    } ${enumerate(', ', ' y ', unresolvedNodeTypes)} ${
      unresolvedNodeTypes.lenght === 1 ? 'is' : 'son'
    } vinculado`,
  }),

  // Constructor patches
  CONSTRUCTOR_PATCH_CANT_HAVE_GENERIC_PINS: ({ trace }) => ({
    title: 'Parche de constructor no válido',
    note: "Los parches de constructor no pueden tener pines genéricos",
    trace,
  }),
  CONSTRUCTOR_PATCH_MUST_BE_NIIX: ({ trace }) => ({
    title: 'Parche de constructor no válido',
    note: 'Los parches de constructor deben implementarse en C ++ ',
    solution: 'Agregue un nodo no implementado en xod y proporcione una implementación',
    trace,
  }),

  // Variadics
  NO_VARIADIC_MARKERS: ({ trace }) => ({
    title: "Can't compute variadic pins",
    note: `Patch has no variadic markers.`,
    trace,
  }),
  TOO_MANY_VARIADIC_MARKERS: ({ trace }) => ({
    title: 'Invalid variadic patch',
    note: `Patch has more than one variadic-* marker`,
    trace,
  }),
  NOT_ENOUGH_VARIADIC_INPUTS: ({
    trace,
    arityStep,
    outputCount,
    minInputs,
  }) => ({
    title: 'Invalid variadic patch',
    note: `A variadic-${arityStep} patch with ${outputCount} outputs should have at least ${minInputs} inputs`,
    trace,
  }),
  WRONG_VARIADIC_PIN_TYPES: ({ accPinLabels, outPinLabels, trace }) => ({
    title: 'Invalid variadic patch',
    note: `Types of inputs ${accPinLabels.join(
      ', '
    )} should match the types of outputs ${outPinLabels.join(', ')}`,
    trace,
  }),
  VARIADIC_HAS_NO_OUTPUTS: ({ trace }) => ({
    title: 'Invalid variadic patch',
    note: `A variadic patch should have at least one output`,
    trace,
  }),

  // Transpile
  IMPLEMENTATION_NOT_FOUND: ({ patchPath, trace }) => ({
    title: 'No se encontró implementación en el parche de hoja',
    note: `No se encontró ninguna implementación para ${patchPath} .`,
    trace,
  }),
  CPP_AS_ENTRY_POINT: ({ patchPath }) => ({
    title: "No se puede transpilar el parche seleccionado",
    note: `No se puede usar el patch "${patchPath}" como punto de entrada, porque no está implementado en XOD`,
  }),
  ABSTRACT_AS_ENTRY_POINT: ({ patchPath }) => ({
    title: "No se puede transpilar el parche seleccionado",
    note: `No se puede utilizar el parche abstracto "${patchPath}" como punto de entrada`,
  }),
  ENTRY_POINT_PATCH_NOT_FOUND_BY_PATH: ({ patchPath }) => ({
    title: 'Entry point patch not found',
    note: `Entry point patch not found by path "${patchPath}"`,
  }),

  // Project validation
  LINK_INPUT_NODE_NOT_FOUND: ({ trace }) => ({
    title: 'Enlace no válido',
    note: 'El nodo de entrada del enlace no existe en este patch',
    trace,
  }),
  LINK_OUTPUT_NODE_NOT_FOUND: ({ trace }) => ({
    title: 'Enlace no válido',
    note: 'El nodo de salida del enlace no existe en este patch',
    trace,
  }),
  INCOMPATIBLE_PINS__CANT_CAST_TYPES_DIRECTLY: ({
    fromType,
    toType,
    trace,
  }) => ({
    title: 'El programa contiene enlaces incorrectos',
    note: `El tipo ${fromType} no se puede convertir a ${toType} directamente.`,
    solution: `Reemplace los enlaces defectuosos con nodos que conviertan explícitamente ${fromType} a ${toType}`,
    trace,
  }),
  INCOMPATIBLE_PINS__LINK_CAUSES_TYPE_CONFLICT: ({ types, trace }) => ({
    title: 'El programa contiene enlaces incorrectos',
    note: `El enlace provoca un conflicto de tipos entre ${enumerate(
      ', ',
      ' y ',
      types
    )}`,
    trace,
    // TODO: Add a solution
  }),
  DEAD_REFERENCE__PINS_NOT_FOUND: ({ pinKey, patchPath, trace }) => ({
    title: 'Error de referencia roto',
    note: `No puedo encontrar el Pin "${pinKey}" en el parche con la ruta "${patchPath}"`,
    trace,
  }),
  CLASHING_PIN_LABELS: ({ label, pinKeys, trace }) => ({
    title: 'Enfrentarse nombres de pin',
    note: `Los pines de ${pinKeys.length} se llaman ${label}`,
    solution: 'Dar a los pines nombres únicos',
    trace,
  }),
  DEAD_REFERENCE__PATCH_FOR_NODE_NOT_FOUND: ({ nodeType, trace }) => ({
    title: 'Error de referencia roto',
    note: `El patch "${nodeType}" no se encuentra en el proyecto`,
    trace,
  }),
  DEAD_REFERENCE__NODE_NOT_FOUND: ({ nodeId, patchPath, trace }) => ({
    title: 'Error de referencia roto',
    note: `No puedo encontrar el nodo "${nodeId}" en el parche con la ruta "${patchPath}"`,
    trace,
  }),
  INVALID_LITERAL_BOUND_TO_PIN: ({ pinName, literal, trace }) => ({
    title: 'Valor literal incorrecto',
    note: `El valor ${literal} vinculado a ${pinName} no es válido.`,
    solution: `Si te refieres a una cadena, escríbela entre comillas dobles: "${literal}".`,
    trace,
  }),
  LOOPS_DETECTED: () => ({
    title: 'Bucles detectados',
    note: 'El programa tiene un ciclo',
    solution: 'Use el nodo xod/core/defer para romper el ciclo',
  }),
  BAD_LITERAL_VALUE: ({ value }) => ({
    title: 'Valor literal incorrecto',
    note: `${value} no es un literal válido`,
    solution: `Si te refieres a una cadena, escríbela entre comillas dobles: "${value}".`,
  }),

  ORPHAN_FROM_BUS_NODES: ({ label, trace }) => ({
    title: 'Sin fuente de bus',
    trace,
    note: `El bus '${label}' no existe`,
    solution: `Cree un nodo 'to-bus' con la etiqueta '${label}' para definir el bus requerido.`,
  }),
  CONFLICTING_TO_BUS_NODES: ({ label, trace }) => ({
    title: 'Varias fuentes de bus',
    trace,
    note: `El bus '${label}' tiene varias fuentes en conflicto`,
    solution: `Elimine o cambie el nombre de uno de los nodos 'to-bus' para que el bus obtenga una única fuente de datos.`,
  }),
  FLOATING_TO_BUS_NODES: ({ label, trace }) => ({
    title: 'El bus flota',
    trace,
    note: `La fuente del buss '${label}' no está vinculada a alguna parte`,
    solution: `Vincula el nodo 'to-bus' con la etiqueta '${label}' a un pin de salida de otro nodo.`,
  }),

  // Patch rebasing
  CANT_REBASE_PATCH__OCCUPIED_PATH: ({ newPath }) => ({
    title: `No se puede cambiar la base del parche`,
    note: `Ya existe otro parche con la ruta "${newPath}" .`,
    solution: 'Cambiar el nombre o eliminar el parche existente antes de',
  }),
  CANT_REBASE_PATCH__BUILT_IN_PATCH: ({ oldPath }) => ({
    title: "No se puede cambiar la base del parche",
    note: `No se puede cambiar la base del parche integrado "${oldPath}"`,
  }),
  CANT_REBASE_PATCH__PATCH_NOT_FOUND_BY_PATH: ({ oldPath }) => ({
    title: `No se puede cambiar la base del parche`,
    note: `No se puede encontrar el parche en el proyecto con la ruta especificada: "${oldPath}"`,
  }),

  // Load project
  INVALID_XODBALL_FORMAT: () => ({
    title: 'Formato de xodball no válido',
    note: 'El archivo que intenta cargar está dañado y tiene una estructura incorrecta',
  }),
  NOT_A_JSON: () => ({
    title: 'No es un formato JSON',
    note: 'El archivo que intenta cargar no está en formato JSON',
  }),
};
