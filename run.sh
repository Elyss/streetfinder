#!/usr/bin/env bash
set -a
[ -f .env ] && source .env
set +a

ACTION="$1"
TARGET="$2"
ENV="$3"  # Only used for front builds

docker_login() {
  if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ]; then
    echo "Docker credentials not set. Please export DOCKER_USERNAME and DOCKER_PASSWORD."
    sleep 10
    exit 1
  fi
  echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USERNAME" --password-stdin
}

if [ -z "$ACTION" ]; then
  echo "No action specified."
  exit 1
fi

case "$ACTION" in

  #---------------------------------------
  # 1) PUSH ACTION
  #    ./run.sh push [front|back] [prod|preprod]
  #---------------------------------------
  push)
    if [ -z "$TARGET" ]; then
      echo "No image specified (front | back)."
      exit 1
    fi

    docker_login

    case "$TARGET" in
      front)
        if [ -z "$ENV" ]; then
          echo "Please specify the environment for frontend (prod | preprod)."
          exit 1
        fi

        case "$ENV" in
          prod)
            DOCKERFILE="Dockerfile.prod"
            ;;
          preprod)
            DOCKERFILE="Dockerfile.preprod"
            ;;
          *)
            echo "Unknown environment '$ENV'. Please use 'prod' or 'preprod'."
            exit 1
            ;;
        esac

        echo "Building and pushing Frontend ($ENV)..."
        cd frontend || exit 1
        docker build -f "$DOCKERFILE" -t elyssfr/streetfinder-frontend:latest .
        docker push elyssfr/streetfinder-frontend:latest
        cd ..
        ;;

      back)
        echo "Building and pushing Backend..."
        cd backend || exit 1
        docker build -f Dockerfile.prod -t elyssfr/streetfinder-backend:latest .
        docker push elyssfr/streetfinder-backend:latest
        cd ..
        ;;

      *)
        echo "Unknown image '$TARGET'. Please use 'front' or 'back'."
        exit 1
        ;;
    esac
    sleep 10
    ;;

  #---------------------------------------
  # 2) RUN ACTION
  #    ./run.sh run [dev|preprod|prod]
  #---------------------------------------
  run)
    if [ -z "$TARGET" ]; then
      echo "No environment specified (dev | preprod | prod)."
      exit 1
    fi

    case "$TARGET" in
      dev)
        COMPOSE_FILE="docker-compose.yml"
        ;;
      preprod)
        COMPOSE_FILE="docker-compose-preprod.yml"
        ;;
      prod)
        COMPOSE_FILE="docker-compose-prod.yml"
        ;;
      *)
        echo "Unknown environment '$TARGET'. Please use 'dev', 'preprod', or 'prod'."
        exit 1
        ;;
    esac

    echo "Stopping and removing existing containers..."
    docker compose -f "$COMPOSE_FILE" down

    echo "Making migrations..."
    docker compose -f "$COMPOSE_FILE" run --rm backend python manage.py makemigrations

    echo "Migrating..."
    docker compose -f "$COMPOSE_FILE" run --rm backend python manage.py migrate

    echo "Building and starting containers in detached mode..."
    docker compose -f "$COMPOSE_FILE" up --build -d
    ;;

  #---------------------------------------
  # 3) PULL ACTION
  #    ./run.sh pull [prod|preprod]
  #---------------------------------------
  pull)
    if [ -z "$TARGET" ]; then
      echo "No environment specified for pull (prod | preprod)."
      exit 1
    fi

    docker_login

    case "$TARGET" in
      prod)
        COMPOSE_FILE="docker-compose-prod.yml"
        ;;
      preprod)
        COMPOSE_FILE="docker-compose-preprod.yml"
        ;;
      *)
        echo "Unknown environment '$TARGET'. Please use 'prod' or 'preprod'."
        exit 1
        ;;
    esac

    echo "Pulling all images from $COMPOSE_FILE..."
    docker compose -f "$COMPOSE_FILE" pull

    echo "Stopping and removing existing containers..."
    docker compose -f "$COMPOSE_FILE" down

    echo "Making migrations..."
    docker compose -f "$COMPOSE_FILE" run --rm backend python manage.py makemigrations

    echo "Migrating..."
    docker compose -f "$COMPOSE_FILE" run --rm backend python manage.py migrate

    echo "Starting containers in detached mode..."
    docker compose -f "$COMPOSE_FILE" up -d
    ;;

  #---------------------------------------
  # 4) UNKNOWN ACTION
  #---------------------------------------
  *)
    echo "The requested action '$ACTION' is not available."
    exit 1
    ;;
esac
