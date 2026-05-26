import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import tempfile
import pytest
from services.repo_cloner import get_repo_tree, read_key_files, GIT_URL_PATTERN


class TestGitUrlPattern:
    def test_valid_https_url(self):
        assert GIT_URL_PATTERN.match("https://github.com/user/repo.git")
        assert GIT_URL_PATTERN.match("https://github.com/user/repo")
        assert GIT_URL_PATTERN.match("https://gitlab.com/group/project.git")

    def test_valid_ssh_url(self):
        assert GIT_URL_PATTERN.match("git@github.com:user/repo.git")
        assert GIT_URL_PATTERN.match("git@gitlab.com:group/project.git")

    def test_invalid_url(self):
        assert not GIT_URL_PATTERN.match("")
        assert not GIT_URL_PATTERN.match("not a url")
        assert not GIT_URL_PATTERN.match("ftp://files.com/repo")


class TestGetRepoTree:
    def test_returns_tree_with_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "src"))
            os.makedirs(os.path.join(tmp, "docs"))
            open(os.path.join(tmp, "src", "main.py"), "w").close()
            open(os.path.join(tmp, "docs", "readme.md"), "w").close()
            open(os.path.join(tmp, "package.json"), "w").close()

            tree = get_repo_tree(tmp)
            paths = {e["path"].replace("\\", "/") for e in tree}

            assert "package.json" in paths
            assert "src/main.py" in paths
            assert "docs/readme.md" in paths

    def test_excludes_hidden_dirs(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, ".git"))
            os.makedirs(os.path.join(tmp, "src"))
            open(os.path.join(tmp, ".git", "config"), "w").close()
            open(os.path.join(tmp, "src", "app.js"), "w").close()

            tree = get_repo_tree(tmp)
            paths = {e["path"].replace("\\", "/") for e in tree}
            assert all(".git" not in p for p in paths)

    def test_excludes_node_modules(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "node_modules", "lodash"))
            open(os.path.join(tmp, "node_modules", "lodash", "index.js"), "w").close()
            open(os.path.join(tmp, "package.json"), "w").close()

            tree = get_repo_tree(tmp)
            paths = {e["path"].replace("\\", "/") for e in tree}
            assert "package.json" in paths
            assert all("node_modules" not in p for p in paths)

    def test_empty_dir_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree = get_repo_tree(tmp)
            assert tree == []


class TestReadKeyFiles:
    def test_reads_key_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            open(os.path.join(tmp, "package.json"), "w").write('{"name": "test"}')
            open(os.path.join(tmp, "Dockerfile"), "w").write("FROM node:20")
            open(os.path.join(tmp, ".env.example"), "w").write("SECRET=xyz")

            files = read_key_files(tmp)
            assert "package.json" in files
            assert "Dockerfile" in files
            assert ".env.example" in files
            assert files["package.json"] == '{"name": "test"}'

    def test_respects_max_size(self):
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(tmp, "big.txt"), "w") as f:
                f.write("x" * 200_000)
            with open(os.path.join(tmp, "small.txt"), "w") as f:
                f.write("small")

            files = read_key_files(tmp, max_size=100_000)
            assert "small.txt" not in files
            assert "big.txt" not in files

    def test_empty_dir_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            files = read_key_files(tmp)
            assert files == {}

    def test_handles_binary_files_gracefully(self):
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(tmp, "Dockerfile"), "wb") as f:
                f.write(b"\x00\x01\x02\x03")
            files = read_key_files(tmp)
            assert "Dockerfile" in files
