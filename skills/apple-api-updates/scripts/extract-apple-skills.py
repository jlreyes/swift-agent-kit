#!/usr/bin/env python3
"""Install locally exported Xcode skills, staging the complete update first."""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

SCHEMA = "2"
SKILLS = {
    "swiftui-specialist": "swiftui-specialist",
    "swiftui-whats-new-27": "swiftui-whats-new-27",
    "uikit-app-modernization": "uikit-app-modernization",
    "adopt-c-bounds-safety": "c-bounds-safety",
    "audit-xcode-security-settings": "audit-xcode-security-settings",
    "modernize-tests": "test-modernizer",
    "device-interaction": "device-interaction",
    "translation": "translation",
    "translation-coordinator": "translation-coordinator",
    "accessibility-dynamic-type-specialist": "accessibility-dynamic-type-specialist",
    "accessibility-voiceover-specialist": "accessibility-voiceover-specialist",
    "accessibility-sufficient-contrast-specialist": "accessibility-sufficient-contrast-specialist",
    "app-intents-specialist": "app-intents-specialist",
    "app-intents-whats-new-27": "app-intents-whats-new-27",
    "building-document-based-swiftui-applications": "building-document-based-swiftui-applications",
}
INSTALLS = list(SKILLS.items()) + [("accessibility-dynamic-type-specialist", "ios-dynamic-text")]
MARKER = ".apple-content-extracted"


def frontmatter(text):
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)", text, re.S)
    if not match:
        raise ValueError("SKILL.md is missing YAML frontmatter")
    return match.group(1) + "\n", text[match.end():]


def field(header, name):
    match = re.search(r"(?m)^" + re.escape(name) + r":[^\n]*(?:\n(?:[ \t]+[^\n]*|(?=\n)))*", header)
    if not match:
        raise ValueError("Missing frontmatter field: " + name)
    raw = match.group().split(":", 1)[1].strip()
    if raw.startswith((">", "|")):
        value = " ".join(line.strip() for line in raw.splitlines()[1:])
    elif raw.startswith('"'):
        value = json.loads(raw)
    elif raw.startswith("'") and raw.endswith("'"):
        value = raw[1:-1].replace("''", "'")
    else:
        value = raw
    return value, match.span()


def replace_field(header, name, value):
    _, (start, end) = field(header, name)
    return header[:start] + name + ": " + json.dumps(value, ensure_ascii=False) + header[end:]


def adapt(text, public_name, description, namespace, note=""):
    header, body = frontmatter(text)
    original, _ = field(header, "description")
    header = replace_field(header, "name", public_name)
    header = replace_field(header, "description", description)
    header = header.rstrip() + "\noriginal_description: " + json.dumps(original, ensure_ascii=False) + "\n"
    if "\nwhen_to_use:" not in "\n" + header:
        header = header.rstrip() + "\nwhen_to_use: " + json.dumps(original, ensure_ascii=False) + "\n"
    text = "---\n" + header + "---\n" + ("\n" + note.strip() + "\n\n" if note else "") + body
    return portable(text, namespace)


def portable(text, namespace):
    text = text.replace("xcode-integration:", namespace)
    for source, target in SKILLS.items():
        if source != target:
            text = text.replace(source, target)
    return text


def xcode():
    candidates = [os.environ.get("DEVELOPER_DIR")]
    try:
        candidates.append(subprocess.check_output(["/usr/bin/xcode-select", "-p"], text=True).strip())
    except (OSError, subprocess.CalledProcessError):
        pass
    candidates += ["/Applications/Xcode.app/Contents/Developer", "/Applications/Xcode-beta.app/Contents/Developer"]
    for candidate in candidates:
        if candidate and (Path(candidate) / "usr/bin/mcpbridge").is_file():
            env = dict(os.environ, DEVELOPER_DIR=candidate)
            result = subprocess.check_output(["/usr/bin/xcrun", "xcodebuild", "-version"], env=env, text=True, timeout=60)
            match = re.search(r"^Build version (\S+)", result, re.M)
            if not match:
                raise ValueError("Unable to determine the selected Xcode build")
            return Path(candidate), match.group(1), env
    raise ValueError("No Xcode installation found; install Xcode 27 and set DEVELOPER_DIR")


def fresh(skills, build):
    try:
        marker = dict(line.split("=", 1) for line in (skills / MARKER).read_text().splitlines())
        docs = json.loads(marker["documentation"])
        files = json.loads(marker["files"])
        return (marker.get("schema") == SCHEMA and marker.get("xcode_build") == build
                and all((skills / name / "SKILL.md").is_file() and 'stub: "true"' not in (skills / name / "SKILL.md").read_text() for _, name in INSTALLS)
                and bool(files) and all((skills / name).is_file() for name in files)
                and len(docs) >= 20 and all((skills / "apple-api-updates/references" / name).is_file() for name in docs))
    except (OSError, ValueError, KeyError):
        return False


def install(source, docs, skills, build):
    skills = skills.resolve()
    if (skills.parent / ".git").exists():
        raise ValueError("Refusing to overwrite a Git checkout with Apple content. Install the kit first, or use --skills-dir with a separate local copy of its skills directory.")
    namespace = "swift-agent-kit:" if (skills.parent / ".claude-plugin/plugin.json").exists() else ""
    notes = json.loads(Path(__file__).with_name("integration-notes.json").read_text())
    fallback_descriptions = json.loads(Path(__file__).with_name("descriptions.json").read_text())
    unexpected = sorted(path.name for path in (source / "skills").iterdir() if path.is_dir() and path.name not in SKILLS)
    if unexpected:
        raise ValueError("Xcode exports additional skills; update Swift Agent Kit before extraction: " + ", ".join(unexpected))
    documents = sorted(docs.glob("*.md"))
    if len(documents) < 20:
        raise ValueError("Expected at least 20 Xcode AdditionalDocumentation guides; export layout may have changed")
    # Everything is prepared on the destination filesystem before the first swap.
    with tempfile.TemporaryDirectory(prefix=".apple-stage-", dir=skills) as temporary:
        stage = Path(temporary)
        replacements = []
        installed_files = []
        for official, public in INSTALLS:
            src = source / "skills" / official
            if not (src / "SKILL.md").is_file():
                raise ValueError("Official Xcode plugin is missing skill: " + official)
            target = skills / public
            if (target / "SKILL.md").is_file():
                curated, _ = field(frontmatter((target / "SKILL.md").read_text())[0], "description")
            else:
                curated = fallback_descriptions[public]
            if not curated or len(curated) > 1024:
                raise ValueError("Kit description must contain 1–1024 characters: " + public)
            dest = stage / public
            shutil.copytree(src, dest)
            original = (src / "SKILL.md").read_text()
            if public == "ios-dynamic-text":
                guide = dest / "references/implementation-guide.md"
                if not guide.is_file():
                    raise ValueError("Xcode Dynamic Type implementation guide is missing")
                original = guide.read_text()
                # The legacy guide lives one level deeper in the official tree.
                original = original.replace("./uikit-examples.md", "references/uikit-examples.md")
                original = original.replace("./swiftui-examples.md", "references/swiftui-examples.md")
            (dest / "SKILL.md").chmod((dest / "SKILL.md").stat().st_mode | 0o200)
            (dest / "SKILL.md").write_text(adapt(original, public, curated, namespace, notes.get(public, "")))
            for markdown in dest.rglob("*.md"):
                original_text = markdown.read_text()
                updated_text = portable(original_text, namespace)
                if updated_text != original_text:
                    markdown.chmod(markdown.stat().st_mode | 0o200)
                    markdown.write_text(updated_text)
            installed_files.extend(str(Path(public) / path.relative_to(dest)) for path in dest.rglob("*") if path.is_file())
            replacements.append((dest, target))
        api = skills / "apple-api-updates"
        if not (api / "SKILL.md").is_file():
            raise ValueError("apple-api-updates must be installed beside the Apple skills")
        reference_stage = stage / "api-references"
        if (api / "references").exists():
            shutil.copytree(api / "references", reference_stage)
        else:
            reference_stage.mkdir()
        for document in documents:
            shutil.copy2(document, reference_stage / document.name)
        replacements.append((reference_stage, api / "references"))
        marker = stage / MARKER
        marker.write_text("schema=" + SCHEMA + "\nxcode_build=" + build + "\nextracted_at=" + datetime.datetime.now(datetime.timezone.utc).isoformat() + "\ndocumentation=" + json.dumps([p.name for p in documents]) + "\nfiles=" + json.dumps(sorted(installed_files)) + "\n")
        replacements.append((marker, skills / MARKER))
        completed = []
        try:
            for index, (prepared, target) in enumerate(replacements):
                backup = stage / ("backup-" + str(index))
                if target.exists() or target.is_symlink():
                    target.rename(backup)
                completed.append((target, backup))
                prepared.rename(target)
        except BaseException:
            for target, backup in reversed(completed):
                if target.is_symlink():
                    target.unlink()
                elif target.is_dir():
                    shutil.rmtree(target)
                elif target.exists():
                    target.unlink()
                if backup.exists() or backup.is_symlink():
                    backup.rename(target)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skills-dir", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--check", action="store_true", help="Exit successfully only for a complete installation matching this Xcode and installer schema")
    args = parser.parse_args()
    try:
        developer, build, env = xcode()
        if args.check:
            return 0 if fresh(args.skills_dir, build) else 1
        result = subprocess.run(["/usr/bin/xcrun", "agent", "plugin", "path", "--plugin-format", "codex"], env=env, text=True, capture_output=True, timeout=60, check=True)
        source = Path(result.stdout.strip())
        if not source.is_dir():
            raise ValueError("Xcode did not return an official plugin directory")
        docs = developer.parent / "PlugIns/IDEIntelligenceChat.framework/Versions/A/Resources/AdditionalDocumentation"
        install(source, docs, args.skills_dir, build)
        print("Installed 16 Apple skill entries (15 official skills plus ios-dynamic-text) and AdditionalDocumentation from Xcode build " + build + ".")
        print("Reload plugins or start a new session to refresh cached skill bodies.")
        return 0
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        if not args.check:
            print("error: " + str(error) + "\nRequires Xcode 27 with `xcrun agent plugin path --plugin-format codex` support.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
