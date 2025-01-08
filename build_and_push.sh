docker buildx build \
  -f build_and_push.Dockerfile \
  -t nullmastermind/langflow:latest \
  --push \
  .