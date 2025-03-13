package main

import (
	"fmt"
	"html/template"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

var (
	TEMPLATES_DIR = filepath.Join(DIR, "templates")
)

func templatesEnsureNoCircularDependency(t *Template, visited []*Template) ([]*Template, *Template, bool) {
	isCircular := false
	var circularTemplate *Template = nil

	for _, dt := range t.Dependencies {
		for _, vt := range visited {
			if vt == dt {
				return visited, dt, true
			}
		}
		visited = append(visited, dt)
		visited, circularTemplate, isCircular = templatesEnsureNoCircularDependency(dt, visited)
		if isCircular {
			break
		}
		visited = visited[:len(visited)-1]
	}
	return visited, circularTemplate, isCircular
}

func templatesFlattenDependencies(t *Template, rm map[string]*TemplateRendererEntry, flattened []*TemplateRendererEntry) []*TemplateRendererEntry {
	for _, dt := range t.Dependencies {
		found := false
		for _, ve := range flattened {
			if dt == ve.T {
				found = true
			}
		}
		if found {
			continue
		}
		flattened = append(flattened, rm[dt.Name])
	}
	return flattened
}

func templatesAddDependents(dm map[*Template]*TemplateDependent, t *Template) *TemplateDependent {
	tr, ok := dm[t]
	if !ok {
		tr = &TemplateDependent{T: t, Dependents: nil}
		dm[t] = tr
	}

	for _, d := range t.Dependencies {
		dr := templatesAddDependents(dm, d)
		dr.Dependents = append(dr.Dependents, tr)
	}

	return tr
}

type Template struct {
	Name string
	Path string
	Dependencies []*Template //list of explicit dependencies
	Modified time.Time
	Built *template.Template
}

func (t *Template) IsLatest() (bool, time.Time, error) {
	stat, err := os.Stat(t.Path)
	if err != nil {
		return false, time.Time{}, err
	}
	mod := stat.ModTime()
	return mod.Equal(t.Modified), mod, nil
}

type TemplateRendererEntry struct {
	T *Template
	DependencyList []*TemplateRendererEntry //list of all dependencies
}

func (e *TemplateRendererEntry) Paths() []string {
	l := len(e.DependencyList)
	paths := make([]string, l, l+1)
	for i := l-1; i > -1; i-- {
		paths[i-l+1] = e.DependencyList[i].T.Path
	}
	paths = append(paths, e.T.Path)
	return paths
}

func (e *TemplateRendererEntry) Update(r *TemplateRenderer) (bool, error) {
	latest, mod, err := e.T.IsLatest()
	if err != nil {
		return false, err
	} else if latest {
		return false, nil
	}
	
	tmpl := template.New(e.T.Name).Funcs(r.FuncMap)
	paths := e.Paths()
	tmpl, err = tmpl.ParseFiles(paths...)
	if err != nil {
		return false, err
	}
	e.T.Modified = mod
	e.T.Built = tmpl
	return true, nil
}

type TemplateDependent struct {
	T *Template
	Dependents []*TemplateDependent //list of templates that directly depend on this template
}

func (d *TemplateDependent) ExpireDependents() {
	for _, dr := range d.Dependents {
		dr.ExpireDependents()
		dr.T.Modified = time.Time{}
	}
}

type TemplateRenderer struct {
	Templates map[string]*TemplateRendererEntry
	DependentTrees map[*Template]*TemplateDependent
	FuncMap template.FuncMap
	uptodate bool
}

func (r *TemplateRenderer) Add(ts ...*Template) {
	for _, t := range ts {
		r.Templates[t.Name] = &TemplateRendererEntry{
			T: t,
			DependencyList: nil,
		}
	}
	r.uptodate = false
}

func (r *TemplateRenderer) UpdateDependecies() error {
	if (r.uptodate) {
		return nil
	}
	for _, e := range r.Templates {
		found, ct, isCircular := templatesEnsureNoCircularDependency(e.T, make([]*Template, 0))
		if isCircular {
			builder := strings.Builder{}
			lenMin1 := len(found) - 1
			size := lenMin1 * 2
			for _, ft := range found {
				size += len(ft.Name)
			}
			builder.Grow(size)
			for i := 0; i < lenMin1; i++ {
				builder.WriteString(found[i].Name)
				builder.WriteString("->")
			}
			builder.WriteString(found[lenMin1].Name)
			return fmt.Errorf("error while updating TemplateRenderer dependencies: Template %s has circular dependency: %s (%s)", e.T.Name, ct.Name, builder.String())
		}
		templatesAddDependents(r.DependentTrees, e.T)
		e.DependencyList = templatesFlattenDependencies(e.T, r.Templates, e.DependencyList[:0])

	}
	r.uptodate = true
	return nil
}

func (r *TemplateRenderer) Load(name string) (*TemplateRendererEntry, error) {
	e := r.Templates[name]
	l := len(e.DependencyList)
	for i := l-1; i > -1; i-- {
		de := e.DependencyList[i]
		ok, _, err := de.T.IsLatest()
		if err != nil {
			return e, err
		} else if !ok {
			r.DependentTrees[de.T].ExpireDependents()
			break
		}
	}
	_, err := e.Update(r)
	if err != nil {
		return e, err
	}
	return e, nil
}

func (r *TemplateRenderer) Render(w io.Writer, name string, data interface{}, c echo.Context) error {
	err := r.UpdateDependecies()
	if err != nil {
		return err
	}
	e, err := r.Load(name)
	if err != nil {
		return err
	}
	return e.T.Built.ExecuteTemplate(w, name, data)
}

func NewTemplateSource(name string, path string, dependencies ...*Template) *Template {
	return &Template{
		Name: name,
		Path: path,
		Dependencies: dependencies,
		Modified: time.Now(),
		Built: nil,
	}
}

func NewTemplateRenderer() *TemplateRenderer {
	return &TemplateRenderer{
		Templates: make(map[string]*TemplateRendererEntry),
		DependentTrees: make(map[*Template]*TemplateDependent),
		FuncMap: make(template.FuncMap),
		uptodate: true,
	}
}