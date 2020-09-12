const librariesMissing = libraryNames =>
  libraryNames.length
    ? `Primero debes instalar estas bibliotecas: ${libraryNames}`
    : null;

const librariesInstalled = libraryNames =>
  libraryNames.length
    ? `Librerias ${libraryNames} instaladas correctamente`
    : null;

const packagesMissing = packageNames =>
  packageNames.length
    ? `Primero debe instalar estos paquetes: ${packageNames}`
    : null;

const packagesInstalled = packageNames =>
  packageNames.length
    ? `Paquete "${packageNames}" instalado correctamente`
    : null;

export default {
  ARDUINO_DEPENDENCIES_MISSING: ({
    libraries,
    libraryNames,
    packages,
    packageNames,
  }) => ({
    title: 'Faltan dependencias de Arduino',
    solution: [librariesMissing(libraryNames), packagesMissing(packageNames)]
      .filter(a => !!a)
      .join('\r\n'),
    button: 'Descargar e instalar',
    data: { libraries, packages, packageNames },
    persistent: true,
  }),

  ARDUINO_DEPENDENCIES_INSTALLED: ({ libraryNames, packageNames }) => ({
    title: 'Dependencias de Arduino instaladas',
    note: [librariesInstalled(libraryNames), packagesInstalled(packageNames)]
      .filter(a => !!a)
      .join('\r\n'),
    solution: 'Ahora puede cargar el programa',
    persistent: true,
  }),

  ARDUINO_CLI_NOT_FOUND: ({ path, isDev }) => ({
    title: 'arduino-cli no encontrado',
    note: path
      ? `Intente encontrar arduino-cli en la ruta: ${path}`
      : 'Intente encontrar arduino-cli en $PATH',
    solution: isDev
      ? 'Cuando se ejecuta en el modo de desarrollo, `arduino-cli` debería estar disponible en $PATH o configurarse explícitamente con la variable de entorno $XOD_ARDUINO_CLI '
      : 'Esto es un error, infórmalo a los desarrolladores de XOD',
  }),

  ARDUINO_CLI_EXITED_WITH_CODE: ({ path, message, stdout, stderr }) => ({
    title: 'arduino-cli exited with error',
    note: [message, stderr, stdout].filter(s => s !== '').join(' '),
    solution: `Check your arduino-cli: ${path}`,
  }),

  ARDUINO_PACKAGES_UPDATED: () => ({
    title: 'Todos los paquetes de Arduino actualizados',
    persistent: true,
  }),

  COMPILE_TOOL_ERROR: ({ message }) => ({
    title: 'La compilación falló',
    note: `Command ${message}`,
    solution:
      'El código C ++ generado contiene errores. Puede deberse a una mala implementación del nodo o si su placa no es compatible con el código de tiempo de ejecución XOD. El mensaje de error del compilador original está arriba. Corrija los errores de C ++ para continuar. Si cree que es un error, informe el problema a los desarrolladores de XOD.',
  }),

  UPLOAD_TOOL_ERROR: ({ message }) => ({
    title: 'Subida fallida',
    note: `Command ${message}`,
    solution:
      'Asegúrese de que la placa esté conectada, el cable esté funcionando, el modelo de la placa configurado correctamente, el puerto de carga pertenezca a la placa, los controladores de la placa estén instalados, las opciones de carga (si las hay) coincidan con las especificaciones de su placa.',
  }),

  UPLOADED_SUCCESSFULLY: () => ({
    title: 'Subido con éxito',
  }),

  UPDATE_INDEXES_ERROR_BROKEN_FILE: ({ pkgPath, error }) => ({
    title: 'Índice de paquete roto',
    note: `Error: ${error}`,
    solution: `Verifique la corrección de la URL correspondiente en "${pkgPath}/extra.txt" e intente actualizar los índices nuevamente`,
  }),

  UPDATE_INDEXES_ERROR_NO_CONNECTION: ({ pkgPath, error }) => ({
    title: 'No se pueden actualizar los índices',
    note: error,
    solution: `Verifique su conexión a Internet y la exactitud de las URL en "${pkgPath}/extra.txt", luego intente nuevamente`,
  }),
};
