import { describe, expect, it } from 'vitest';
import { conteudosDe, namespaceDe, proximoElemento } from './tags';

describe('proximoElemento', () => {
  it('pula declaração, comentário e DOCTYPE até a raiz', () => {
    const texto = '<?xml version="1.0"?><!-- <falso/> --><!DOCTYPE x><raiz a="1" b=\'2\'/>';
    const tag = proximoElemento(texto);
    expect(tag?.nome).toBe('raiz');
    expect(Object.fromEntries(tag?.atributos ?? [])).toEqual({ a: '1', b: '2' });
  });

  it('pula a tag de fechamento e acha o próximo elemento', () => {
    expect(proximoElemento('</a><b/>')?.nome).toBe('b');
  });

  it('não acha nada em comentário sem fim nem em texto sem tag', () => {
    expect(proximoElemento('<!-- sem fim <a/>')).toBeUndefined();
    expect(proximoElemento('só texto')).toBeUndefined();
  });

  it('lê o namespace pelo prefixo', () => {
    const tag = proximoElemento('<s:raiz xmlns:s="urn:s" xmlns="urn:padrao"/>');
    expect(tag?.prefixo).toBe('s');
    expect(tag && namespaceDe(tag)).toBe('urn:s');
  });
});

describe('conteudosDe', () => {
  it('não confunde nome parecido e ignora elemento sem fechamento', () => {
    const texto = '<eventos><evento Id="1"> <a/> </evento><eventoX/><evento Id="2">';
    const blocos = conteudosDe(texto, 'evento');
    expect(blocos.map((b) => [b.abertura.atributos.get('Id'), b.conteudo])).toEqual([
      ['1', '<a/>'],
    ]);
  });
});
