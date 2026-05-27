"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

from config.observability import setup_tracing

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Tracing must be initialized before the WSGI app is built so DjangoInstrumentor
# can wrap the handler.
setup_tracing()

application = get_wsgi_application()
