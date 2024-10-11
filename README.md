# Moduler

![License](https://img.shields.io/badge/license-ISC-brightgreen)

**SIO-Moduler** es un paquete para Node.js que permite hacer públicos cualquier paquete de `node_modules` y sirve como un middleware en aplicaciones Express. Esto es útil para facilitar la importación de módulos en el navegador.

SIO-Moduler usa la propiedad exports de los paquetes para generar las rutas que serán utilizadas, en caso de que no exista esta propiedad, se genera usando la propiedad module o la propiedad main, por último si no existe ningúna de estas busca la existencia del archivo "index.js" en el proyecto.

## Instalación

Puedes instalar SIO-Moduler a través de npm:

```bash
npm install sio-moduler
```

## Uso

Una vez instalado, puedes utilizar Moduler en tu aplicación Express de la siguiente manera:

```javascript
import express from 'express';
import moduler from 'sio-moduler';

const app = express();
const modules = ['nombre-del-modulo']; // Reemplaza por los módulos que quieres exponer

// Utiliza el middleware SIO-Moduler
app.use('/modules', moduler(modules));

// Inicia el servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en el puerto 3000');
});
```

### Importación de Módulos desde el Navegador

Una vez que hayas configurado tu servidor, puedes importar tus módulos directamente desde el navegador utilizando etiquetas `<script>`. Por ejemplo, si expusiste un módulo llamado `nombre-del-modulo`, puedes importarlo de la siguiente manera:

```html
<script type="module">
  import { algo } from '/modules/nombre-del-moduloS';
  
  // Usa 'algo' en tu código
  algo();
</script>
```

### Funcionalidades

- **Importación de Módulos:** SIO-Moduler redefine las rutas de importación para los archivos que se importan desde `node_modules`, permitiendo que sean accesibles desde el navegador.
  
- **Soporte para Dependencias:** SIO-Moduler también maneja las dependencias de tus módulos y las hace accesibles automáticamente.

- **Rutas Dinámicas:** Las rutas se configuran dinámicamente basándose en la estructura de exportación de los paquetes, facilitando su uso.

## Palabras Clave

- node_modules
- public
- browser
- middleware
- express

## Contribución

Si deseas contribuir a SIO-Moduler, por favor envía un pull request o abre un issue.

## Autor

**Siorbita:** Adrián Mercado Martínez

## Licencia

Este proyecto está bajo la licencia ISC. Para más detalles, consulta el archivo LICENSE.
