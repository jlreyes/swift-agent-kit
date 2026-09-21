#!/usr/bin/env python3
"""Opt-in integration check using the selected local Xcode and temporary installs."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


REPOSITORY = Path(__file__).resolve().parents[1]
MODULE = REPOSITORY / "skills/apple-api-updates/scripts/extract-apple-skills.py"
spec = importlib.util.spec_from_file_location("apple_installer", MODULE)
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def snapshot(root):
    return {
        str(path.relative_to(root)): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file() and path.name != installer.MARKER
        and "__pycache__" not in path.parts
    }


def verify_official_files(source, destination, namespace):
    counts = {"official_files": 0, "references": 0, "scripts": 0}
    for official, public in installer.SKILLS.items():
        original = source / "skills" / official
        installed = destination / public
        expected = {str(path.relative_to(original)) for path in original.rglob("*") if path.is_file()}
        actual = {str(path.relative_to(installed)) for path in installed.rglob("*") if path.is_file()}
        require(expected == actual, f"File inventory differs for {public}: {expected ^ actual}")
        for path in original.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(original)
            output = installed / relative
            counts["official_files"] += 1
            if relative.parts[0] in ("references", "scripts"):
                counts[relative.parts[0]] += 1
            if relative.as_posix() == "SKILL.md":
                original_header, original_body = installer.frontmatter(path.read_text())
                header, body = installer.frontmatter(output.read_text())
                require(body.endswith(installer.portable(original_body, namespace)), f"Apple body changed: {public}")
                require(len(installer.field(header, "description")[0]) <= 1024, f"Description too long: {public}")
                description = installer.field(original_header, "description")[0]
                require(installer.field(header, "original_description")[0] == installer.portable(description, namespace), f"Original description lost: {public}")
                try:
                    trigger = installer.field(original_header, "when_to_use")[0]
                except ValueError:
                    trigger = description
                require(installer.field(header, "when_to_use")[0] == installer.portable(trigger, namespace), f"Original trigger lost: {public}")
            elif path.suffix == ".md":
                require(output.read_text() == installer.portable(path.read_text(), namespace), f"Reference changed: {public}/{relative}")
            else:
                require(output.read_bytes() == path.read_bytes(), f"Supporting file changed: {public}/{relative}")
    return counts


def verify_layout(layout, source, documents, build, environment):
    with tempfile.TemporaryDirectory(prefix=f"swift-agent-kit-{layout}-") as temporary:
        root = Path(temporary)
        destination = root / "skills"
        destination.mkdir()
        names = {public for _, public in installer.INSTALLS} | {"apple-api-updates"}
        for name in sorted(names):
            shutil.copytree(REPOSITORY / "skills" / name, destination / name,
                            ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        if layout == "plugin":
            shutil.copytree(REPOSITORY / ".claude-plugin", root / ".claude-plugin")
        script = destination / "apple-api-updates/scripts/extract-apple-skills.sh"
        subprocess.run([str(script)], env=environment, check=True)
        subprocess.run([str(script), "--check"], env=environment, check=True)
        first = snapshot(destination)
        subprocess.run([str(script)], env=environment, check=True)
        require(first == snapshot(destination), f"Repeat extraction changed content in {layout} layout")
        namespace = "swift-agent-kit:" if layout == "plugin" else ""
        counts = verify_official_files(source, destination, namespace)
        guides = list(documents.glob("*.md"))
        for guide in guides:
            require(guide.read_bytes() == (destination / "apple-api-updates/references" / guide.name).read_bytes(), f"API guide changed: {guide.name}")
        legacy_source = source / "skills/accessibility-dynamic-type-specialist/references/implementation-guide.md"
        legacy_body = installer.frontmatter(legacy_source.read_text())[1]
        legacy_body = legacy_body.replace("./uikit-examples.md", "references/uikit-examples.md")
        legacy_body = legacy_body.replace("./swiftui-examples.md", "references/swiftui-examples.md")
        actual_legacy = installer.frontmatter((destination / "ios-dynamic-text/SKILL.md").read_text())[1]
        require(actual_legacy == legacy_body, "Legacy Dynamic Type implementation body changed")
        require(installer.fresh(destination, build), f"Completed {layout} install is not fresh")
        print(json.dumps({"layout": layout, "build": build, **counts,
                          "docs": len(guides), "rerun_identical": True, "complete": True}), flush=True)


def main():
    developer, build, environment = installer.xcode()
    source = Path(subprocess.check_output(
        ["/usr/bin/xcrun", "agent", "plugin", "path", "--plugin-format", "codex"],
        env=environment, text=True, timeout=60).strip())
    documents = developer.parent / "PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation"
    for layout in ("plugin", "flat"):
        verify_layout(layout, source, documents, build, environment)


if __name__ == "__main__":
    main()
