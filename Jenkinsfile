pipeline {
    agent any

    options {
        // Prevent concurrent builds from racing on Git commits
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        REGISTRY = 'ghcr.io'
        IMAGE_NAME = 'squareupstudio/kubepractice'
        MANIFEST_PATH = 'deployment.yaml' // Change to 'manifests/deployment.yaml' if in a subfolder
        GIT_REPO_URL = 'github.com/Ansalpandey/kubernetes-practice.git'
    }

    stages {
        stage('Loop Guard Check') {
            steps {
                script {
                    def lastCommitMsg = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                    if (lastCommitMsg.contains('[skip ci]')) {
                        echo "Commit triggered by GitOps bot ([skip ci]). Aborting pipeline to prevent infinite loop."
                        currentBuild.result = 'ABORTED'
                        error('Stopping build: GitOps manifest-only commit.')
                    }
                }
            }
        }

        stage('Determine Immutable Version') {
            steps {
                script {
                    env.APP_VERSION = sh(script: "grep '\"version\"' package.json | cut -d '\"' -f 4 | head -n 1", returnStdout: true).trim()
                    env.SHORT_SHA = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                    // Combining semver + commit SHA guarantees a unique tag on every push
                    env.IMAGE_TAG = "${env.APP_VERSION}-${env.SHORT_SHA}"
                    echo "Building immutable image tag: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build Image with Podman') {
            steps {
                sh "podman build --network=host -t localhost/ansalpandey/kubepractice:${env.IMAGE_TAG} ."
            }
        }

        stage('Push Image to GHCR') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'e6c0b173-c312-4fea-856d-29bbdca656c6',
                    usernameVariable: 'GHCR_USER',
                    passwordVariable: 'GHCR_PASS'
                )]) {
                    sh '''
                        echo "$GHCR_PASS" | podman login ${REGISTRY} -u "$GHCR_USER" --password-stdin
                        podman tag localhost/ansalpandey/kubepractice:${IMAGE_TAG} ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
                        podman push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
                    '''
                }
            }
        }

        stage('Update GitOps Manifest') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'e6c0b173-c312-4fea-856d-29bbdca656c6', // Ensure token has 'repo' write scope
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_PASS'
                )]) {
                    sh '''
                        git config user.name "Jenkins CI Bot"
                        git config user.email "ci-bot@squareupstudio.local"

                        # Update the image tag in deployment.yaml
                        sed -i "s|image: ${REGISTRY}/${IMAGE_NAME}:.*|image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}|g" ${MANIFEST_PATH}

                        # Only commit and push if deployment.yaml actually changed
                        if ! git diff --quiet ${MANIFEST_PATH}; then
                            git add ${MANIFEST_PATH}
                            git commit -m "chore(gitops): bump image to ${IMAGE_TAG} [skip ci]"
                            git push https://${GIT_USER}:${GIT_PASS}@${GIT_REPO_URL} HEAD:main
                        else
                            echo "No manifest changes detected."
                        fi
                    '''
                }
            }
        }
    }

    post {
        always {
            // Clean up registry auth & local dangling images to save NVMe space
            sh '''
                podman logout ${REGISTRY} || true
                podman image prune -f || true
            '''
        }
    }
}
