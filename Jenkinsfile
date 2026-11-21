def skipCi = false

pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        LOCAL_IMAGE      = 'localhost/ansalpandey/kubepractice'
        REMOTE_IMAGE     = 'ghcr.io/ansalpandey/kubepractice'
        GITOPS_REPO      = 'https://github.com/Ansalpandey/kubernetes-practice.git'
        GITOPS_BRANCH    = 'main'
        GITOPS_MANIFEST  = 'k8s/deployment.yml'
        GITOPS_CONTAINER = 'kubepractice'
    }

    stages {
        stage('Checkout & CI Guard') {
            steps {
                checkout scm
                script {
                    def commitMessage = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                    // Check if ONLY k8s/ files changed in this commit
                    def nonK8sChanges = sh(
                        script: "git diff-tree --no-commit-id --name-only -r HEAD | grep -v '^k8s/' || true",
                        returnStdout: true
                    ).trim()

                    echo "Latest commit: ${commitMessage}"

                    if (commitMessage.contains('[skip ci]') || nonK8sChanges == '') {
                        skipCi = true
                        echo 'Skipping CI build: GitOps/manifest-only commit detected.'
                    }
                }
            }
        }

        stage('Determine Version') {
            when {
                expression { return !skipCi }
            }
            steps {
                script {
                    def appVersion = sh(
                        script: """grep '"version"' package.json | cut -d '"' -f 4 | head -n 1""",
                        returnStdout: true
                    ).trim()

                    def shortSha = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()

                    if (!appVersion || !shortSha) {
                        error('Unable to determine application version or commit SHA.')
                    }

                    env.IMAGE_TAG = "${appVersion}-${shortSha}"
                    echo "Building and pushing version: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Build Docker Image') {
            when {
                expression { return !skipCi }
            }
            steps {
                sh '''
                    podman build \
                        --network=host \
                        -t "${LOCAL_IMAGE}:${IMAGE_TAG}" .
                '''
            }
        }

        stage('Tag & Push Image to GHCR') {
            when {
                expression { return !skipCi }
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
                        echo "$GHCR_PASS" | podman login ghcr.io -u "$GHCR_USER" --password-stdin
                        set -x

                        podman tag "${LOCAL_IMAGE}:${IMAGE_TAG}" "${REMOTE_IMAGE}:${IMAGE_TAG}"
                        podman push "${REMOTE_IMAGE}:${IMAGE_TAG}"
                    '''
                }
            }
        }

        stage('Update GitOps Repository') {
            when {
                expression { return !skipCi }
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

                            git clone "https://${GIT_USER}:${GIT_TOKEN}@github.com/Ansalpandey/kubernetes-practice.git" .
                            git checkout "${GITOPS_BRANCH}"

                            git config user.name "Jenkins CI"
                            git config user.email "jenkins@github.com"

                            sed -i \
                                "/name: ${GITOPS_CONTAINER}/,/image:/s|image:.*|image: ${REMOTE_IMAGE}:${IMAGE_TAG}|" \
                                "${GITOPS_MANIFEST}"

                            git add "${GITOPS_MANIFEST}"

                            if git diff --cached --quiet; then
                                echo "No GitOps manifest changes detected."
                                exit 0
                            fi

                            git commit -m "chore(gitops): update ${GITOPS_CONTAINER} image to ${IMAGE_TAG} [skip ci]"
                            git push origin "HEAD:${GITOPS_BRANCH}"
                        '''
                    }
                }
            }
        }
    }

    post {
        always {
            sh 'podman image prune -f || true'
            echo 'Pipeline execution finished.'
        }
        success {
            echo 'CI/CD pipeline completed successfully.'
        }
        failure {
            echo 'CI/CD pipeline failed. Check the stage logs.'
        }
    }
}