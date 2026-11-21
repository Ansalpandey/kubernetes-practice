
pipeline {
    agent any

    environment {
        SKIP_CI = 'false'

        LOCAL_IMAGE = 'localhost/ansalpandey/kubepractice'
        REMOTE_IMAGE = 'ghcr.io/squareupstudio/kubepractice'

        GITOPS_REPO = 'https://github.com/Ansalpandey/kubernetes-practice.git'
        GITOPS_BRANCH = 'main'
        GITOPS_MANIFEST = 'k8s/deployment.yml'
        GITOPS_CONTAINER = 'kubepractice'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check CI Skip') {
            steps {
                script {
                    def commitMessage = sh(
                        script: 'git log -1 --pretty=%B',
                        returnStdout: true
                    ).trim()

                    echo "Latest commit: ${commitMessage}"

                    if (commitMessage.contains('[skip ci]')) {
                        env.SKIP_CI = 'true'
                        echo 'Skipping CI for GitOps update commit.'
                    }
                }
            }
        }

        stage('Determine Version') {
            when {
                expression { env.SKIP_CI != 'true' }
            }

            steps {
                script {
                    env.APP_VERSION = sh(
                        script: """grep '"version"' package.json | cut -d '"' -f 4 | head -n 1""",
                        returnStdout: true
                    ).trim()

                    if (!env.APP_VERSION) {
                        error('Unable to determine application version.')
                    }

                    env.IMAGE_TAG = env.APP_VERSION

                    echo "Building and pushing version: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build Docker Image') {
            when {
                expression { env.SKIP_CI != 'true' }
            }

            steps {
                sh """
                    podman build \
                        --network=host \
                        --no-cache \
                        -t ${LOCAL_IMAGE}:${IMAGE_TAG} .
                """
            }
        }

        stage('Tag & Push Image to GHCR') {
            when {
                expression { env.SKIP_CI != 'true' }
            }

            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'e6c0b173-c312-4fea-856d-29bbdca656c6',
                        usernameVariable: 'GHCR_USER',
                        passwordVariable: 'GHCR_PASS'
                    )
                ]) {
                    sh '''
                        set +x

                        echo "$GHCR_PASS" | podman login ghcr.io \
                            -u "$GHCR_USER" \
                            --password-stdin
                    '''

                    sh """
                        podman tag \
                            ${LOCAL_IMAGE}:${IMAGE_TAG} \
                            ${REMOTE_IMAGE}:${IMAGE_TAG}

                        podman push ${REMOTE_IMAGE}:${IMAGE_TAG}
                    """
                }
            }
        }

        stage('Update GitOps Repository') {
            when {
                expression { env.SKIP_CI != 'true' }
            }

            steps {
                dir('gitops') {
                    deleteDir()

                    withCredentials([
                        usernamePassword(
                            credentialsId: 'e6c0b173-c312-4fea-856d-29bbdca656c6',
                            usernameVariable: 'GIT_USER',
                            passwordVariable: 'GIT_TOKEN'
                        )
                    ]) {
                        sh '''
                            set -eu

                            git clone \
                                https://${GIT_USER}:${GIT_TOKEN}@github.com/Ansalpandey/kubernetes-practice.git \
                                .

                            git checkout ${GITOPS_BRANCH}

                            git config user.name "Jenkins CI"
                            git config user.email "jenkins@github.com"

                            # Update the target container image.
                            sed -i \
                                "/name: ${GITOPS_CONTAINER}/,/image:/s|image:.*|image: ${REMOTE_IMAGE}:${IMAGE_TAG}|" \
                                ${GITOPS_MANIFEST}

                            git add ${GITOPS_MANIFEST}

                            if git diff --cached --quiet; then
                                echo "No GitOps manifest changes detected."
                                exit 0
                            fi

                            git commit -m "chore(gitops): update ${GITOPS_CONTAINER} image to ${IMAGE_TAG} [skip ci]"

                            git push origin HEAD:${GITOPS_BRANCH}
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'CI/CD pipeline completed successfully.'
        }

        failure {
            echo 'CI/CD pipeline failed. Check the stage logs.'
        }

        always {
            echo "Pipeline execution finished."
        }
    }
}
