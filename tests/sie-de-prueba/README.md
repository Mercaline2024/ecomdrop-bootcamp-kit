# SIE de prueba

Imita la **estructura** del SIE (las rutas que usan el instalador, el doctor y `nueva-tienda.sh`) sin nada de su
contenido: ni skills reales, ni conocimiento, ni plantillas. Lo usa GitHub Actions con `ECOMDROP_SIE_TARBALL`, así las
pruebas nunca descargan ni exponen el SIE real.

```bash
tar -czf sie-de-prueba.tar.gz -C tests/sie-de-prueba sie
```
