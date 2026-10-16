#!/bin/bash
# Script modular de administración VELOX

case $1 in
  usuarios)
    echo "Creando usuario velox..."
    sudo useradd -m velox
    ;;
  firewall)
    echo "Configurando firewall..."
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw enable
    ;;
  respaldo)
    echo "Ejecutando backup..."
    tar czf /var/backups/velox_$(date +%F).tar.gz /var/www/velox
    ;;
  logs)
    echo "Mostrando últimos logs..."
    journalctl -n 50
    ;;
  *)
    echo "Uso: $0 {usuarios|firewall|respaldo|logs}"
    ;;
esac
